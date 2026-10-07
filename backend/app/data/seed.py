"""
Synthetic data generator for DAWNTWIN.

Produces ~200 patients with realistic Indian-population health distributions,
30 days of wearable data per patient, morning BP observations, and deliberately
encoded degradation-before-elevation patterns so the ML pipeline has real signal.
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

# Allow running as `python -m app.data.seed` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.config import (
    DBP_THRESHOLD,
    MORNING_WINDOW_END,
    MORNING_WINDOW_START,
    N_SYNTHETIC_PATIENTS,
    RANDOM_SEED,
    SBP_THRESHOLD,
    WEARABLE_DAYS,
)
from app.models.database import Base, SessionLocal, engine
from app.models.schemas import (
    BPObservation,
    ClinicalHistory,
    Patient,
    TwinState,
    WearableDaily,
)

rng = np.random.default_rng(RANDOM_SEED)

# ---------------------------------------------------------------------------
# 1. Patients
# ---------------------------------------------------------------------------

def generate_patients(n: int = N_SYNTHETIC_PATIENTS) -> list[dict]:
    patients = []
    for _ in range(n):
        age = int(np.clip(rng.normal(50, 12), 30, 75))
        sex = rng.choice(["M", "F"])
        bmi = float(np.clip(rng.normal(25.5, 4.0), 18.0, 38.0))

        # Height: sex-dependent Indian distributions (cm)
        if sex == "M":
            height = float(np.clip(rng.normal(170, 7), 155, 190))
        else:
            height = float(np.clip(rng.normal(158, 6), 145, 175))
        weight = round(bmi * (height / 100) ** 2, 1)

        # Hypertension probability increases with age and BMI
        htn_prob = 0.10 + 0.004 * (age - 30) + 0.015 * max(bmi - 23, 0)
        hypertension = bool(rng.random() < np.clip(htn_prob, 0.05, 0.70))

        # Diabetes correlated with BMI
        dm_prob = 0.04 + 0.012 * max(bmi - 23, 0)
        diabetes = bool(rng.random() < np.clip(dm_prob, 0.03, 0.40))

        dyslipidemia = bool(rng.random() < 0.20)
        family_cvd = bool(rng.random() < 0.25)
        smoking = str(rng.choice(["never", "former", "current"], p=[0.60, 0.20, 0.20]))

        patients.append(dict(
            age=age,
            sex=sex,
            height_cm=round(height, 1),
            weight_kg=weight,
            bmi=round(bmi, 1),
            smoking_status=smoking,
            diabetes_status=diabetes,
            hypertension_status=hypertension,
            dyslipidemia=dyslipidemia,
            family_cvd_history=family_cvd,
        ))
    return patients


# ---------------------------------------------------------------------------
# 2. Clinical history
# ---------------------------------------------------------------------------

def generate_clinical_history(patients: list[dict]) -> list[dict]:
    rows = []
    today = date(2026, 10, 1)

    for pid, pt in enumerate(patients, start=1):
        n_visits = rng.integers(4, 9)  # 4-8 visits
        months_back = int(n_visits * 3)  # quarterly spacing

        for v in range(n_visits):
            visit_date = today - timedelta(days=int(months_back * 30 - v * 90 + rng.integers(-10, 11)))

            if pt["hypertension_status"]:
                sbp = rng.normal(145, 10)
                dbp = rng.normal(92, 7)
            else:
                sbp = rng.normal(120, 8)
                dbp = rng.normal(78, 6)
            # Age/BMI nudge
            sbp += (pt["age"] - 50) * 0.3 + (pt["bmi"] - 25) * 0.5
            dbp += (pt["age"] - 50) * 0.15 + (pt["bmi"] - 25) * 0.3

            rhr = rng.normal(72, 6)

            glucose = rng.normal(110 if pt["diabetes_status"] else 92, 12)
            hba1c = rng.normal(7.2 if pt["diabetes_status"] else 5.4, 0.6)
            creatinine = rng.normal(1.0, 0.2)
            ldl = rng.normal(140 if pt["dyslipidemia"] else 110, 18)

            medication = pt["hypertension_status"] and rng.random() < 0.60

            rows.append(dict(
                patient_id=pid,
                measurement_date=visit_date,
                systolic_bp=round(float(sbp), 1),
                diastolic_bp=round(float(dbp), 1),
                resting_hr=round(float(np.clip(rhr, 55, 100)), 1),
                glucose=round(float(np.clip(glucose, 70, 200)), 1),
                hba1c=round(float(np.clip(hba1c, 4.0, 12.0)), 1),
                creatinine=round(float(np.clip(creatinine, 0.5, 2.5)), 2),
                ldl=round(float(np.clip(ldl, 50, 250)), 1),
                medication_flag=medication,
            ))
    return rows


# ---------------------------------------------------------------------------
# 3. Wearable daily data  +  4. BP observations
# ---------------------------------------------------------------------------

def _patient_baselines(pt: dict) -> dict:
    """Derive per-patient physiological baselines from static profile."""
    age, bmi, htn = pt["age"], pt["bmi"], pt["hypertension_status"]
    return dict(
        resting_hr=float(rng.normal(68 + (age - 40) * 0.15 + (bmi - 25) * 0.3, 2)),
        hrv=float(rng.normal(55 - (age - 30) * 0.4, 5)),
        steps=int(rng.normal(8500 - (age - 40) * 40, 800)),
        active_minutes=int(rng.normal(45 - (age - 40) * 0.3, 8)),
        sleep_duration=float(rng.normal(7.0, 0.4)),
        sleep_efficiency=float(rng.normal(0.85, 0.04)),
        sleep_start=float(rng.normal(23.0, 0.5)),  # 11 PM
        # Base morning SBP/DBP
        sbp_base=float(rng.normal(138 if htn else 118, 5)),
        dbp_base=float(rng.normal(90 if htn else 76, 4)),
    )


def generate_wearable_and_bp(
    patients: list[dict],
    days: int = WEARABLE_DAYS,
) -> tuple[list[dict], list[dict]]:
    """
    Generate wearable daily records AND matching morning BP observations.

    The key design: we first decide which mornings will be "elevated BP" events,
    then retroactively degrade the preceding 2-5 days of wearable data.  This
    encodes the signal the ML model needs to learn while keeping noise realistic.
    """
    wearable_rows: list[dict] = []
    bp_rows: list[dict] = []
    start_date = date(2026, 9, 1)

    for pid, pt in enumerate(patients, start=1):
        bl = _patient_baselines(pt)

        # --- Decide elevated-BP mornings first ---
        elevation_rate = 0.35 if pt["hypertension_status"] else 0.20
        is_elevated = rng.random(days) < elevation_rate

        # Mark degradation windows: 2-5 days BEFORE each elevated morning
        degraded = np.zeros(days, dtype=bool)
        for d in range(days):
            if is_elevated[d]:
                stretch = rng.integers(2, 6)  # 2-5 preceding days
                lo = max(0, d - stretch)
                degraded[lo : d + 1] = True

        # --- Generate daily wearable stream with autocorrelation ---
        prev_hr = bl["resting_hr"]
        prev_hrv = bl["hrv"]
        prev_steps = bl["steps"]
        prev_sleep = bl["sleep_duration"]
        prev_eff = bl["sleep_efficiency"]
        prev_start = bl["sleep_start"]

        for d in range(days):
            day_date = start_date + timedelta(days=d)

            # Autocorrelation: 60% carry-over from yesterday, 40% new draw
            ac = 0.6

            if degraded[d]:
                # Degraded day: shift towards worse values
                hr_target = bl["resting_hr"] + rng.uniform(5, 10)
                hrv_target = bl["hrv"] * rng.uniform(0.70, 0.85)
                steps_target = bl["steps"] * rng.uniform(0.60, 0.80)
                sleep_target = bl["sleep_duration"] * rng.uniform(0.75, 0.88)
                eff_target = bl["sleep_efficiency"] * rng.uniform(0.80, 0.92)
                active_target = bl["active_minutes"] * rng.uniform(0.50, 0.75)
            else:
                # Normal day: hover around personal baseline
                hr_target = bl["resting_hr"] + rng.normal(0, 2)
                hrv_target = bl["hrv"] + rng.normal(0, 4)
                steps_target = bl["steps"] + rng.normal(0, 1200)
                sleep_target = bl["sleep_duration"] + rng.normal(0, 0.5)
                eff_target = bl["sleep_efficiency"] + rng.normal(0, 0.03)
                active_target = bl["active_minutes"] + rng.normal(0, 8)

            resting_hr = round(float(np.clip(ac * prev_hr + (1 - ac) * hr_target, 50, 110)), 1)
            avg_hr = round(resting_hr + rng.uniform(5, 15), 1)
            hrv = round(float(np.clip(ac * prev_hrv + (1 - ac) * hrv_target, 8, 120)), 1)
            steps = int(np.clip(ac * prev_steps + (1 - ac) * steps_target, 500, 25000))
            active_min = int(np.clip(active_target, 0, 120))
            sleep_dur = round(float(np.clip(ac * prev_sleep + (1 - ac) * sleep_target, 3.0, 10.0)), 2)
            sleep_eff = round(float(np.clip(ac * prev_eff + (1 - ac) * eff_target, 0.40, 0.99)), 2)
            sleep_start = round(float(np.clip(
                ac * prev_start + (1 - ac) * (bl["sleep_start"] + rng.normal(0, 0.4)),
                21.0, 26.0,  # 9 PM – 2 AM (as 26 = next-day 02:00)
            )), 2)
            sleep_end = round(sleep_start + sleep_dur, 2)

            sensor_q = round(float(rng.choice([1.0, 0.95, 0.9, 0.85, 0.6], p=[0.4, 0.25, 0.2, 0.1, 0.05])), 2)

            wearable_rows.append(dict(
                patient_id=pid,
                date=day_date,
                avg_hr=avg_hr,
                resting_hr=resting_hr,
                hrv=hrv,
                steps=steps,
                active_minutes=active_min,
                sleep_duration=sleep_dur,
                sleep_efficiency=sleep_eff,
                sleep_start=sleep_start,
                sleep_end=sleep_end,
                sensor_quality=sensor_q,
            ))

            # Carry forward for autocorrelation
            prev_hr, prev_hrv = resting_hr, hrv
            prev_steps, prev_sleep = steps, sleep_dur
            prev_eff, prev_start = sleep_eff, sleep_start

            # --- Morning BP observation ---
            hour = rng.uniform(MORNING_WINDOW_START, MORNING_WINDOW_END)
            minute = rng.integers(0, 60)
            ts = datetime(day_date.year, day_date.month, day_date.day,
                          int(hour), int(minute))

            if is_elevated[d]:
                sbp = bl["sbp_base"] + rng.uniform(8, 20) + rng.normal(0, 5)
                dbp = bl["dbp_base"] + rng.uniform(5, 14) + rng.normal(0, 4)
            else:
                sbp = bl["sbp_base"] + rng.normal(0, 6)
                dbp = bl["dbp_base"] + rng.normal(0, 4)

            sbp = round(float(np.clip(sbp, 90, 210)), 1)
            dbp = round(float(np.clip(dbp, 55, 130)), 1)

            bp_rows.append(dict(
                patient_id=pid,
                timestamp=ts,
                systolic_bp=sbp,
                diastolic_bp=dbp,
                measurement_source="cuff",
                measurement_quality=round(float(rng.uniform(0.85, 1.0)), 2),
            ))

    return wearable_rows, bp_rows


# ---------------------------------------------------------------------------
# 5. Seed database
# ---------------------------------------------------------------------------

def seed_database() -> None:
    print("Dropping and recreating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    print(f"Generating {N_SYNTHETIC_PATIENTS} synthetic patients...")
    patients_data = generate_patients(N_SYNTHETIC_PATIENTS)

    db = SessionLocal()
    try:
        # -- Patients --
        patient_objs = [Patient(**p) for p in patients_data]
        db.add_all(patient_objs)
        db.flush()  # assigns ids
        print(f"  {len(patient_objs)} patients created")

        # -- Clinical history --
        clin_data = generate_clinical_history(patients_data)
        db.add_all([ClinicalHistory(**r) for r in clin_data])
        print(f"  {len(clin_data)} clinical-history records created")

        # -- Wearable + BP --
        print("  Generating wearable + BP data (this takes a moment)...")
        wearable_data, bp_data = generate_wearable_and_bp(patients_data)
        db.add_all([WearableDaily(**r) for r in wearable_data])
        print(f"  {len(wearable_data)} wearable-daily records created")
        db.add_all([BPObservation(**r) for r in bp_data])
        print(f"  {len(bp_data)} BP observations created")

        # Verify elevation rate
        elevated = sum(
            1 for r in bp_data
            if r["systolic_bp"] >= SBP_THRESHOLD or r["diastolic_bp"] >= DBP_THRESHOLD
        )
        print(f"  Elevated mornings: {elevated}/{len(bp_data)} "
              f"({100 * elevated / len(bp_data):.1f}%)")

        db.commit()
        print("Database seeded successfully.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
