from sqlalchemy.orm import Session
from app.models.schemas import Patient, ClinicalHistory, WearableDaily
import pandas as pd
import numpy as np


def build_features(patient_id: int, db_session: Session) -> pd.DataFrame:
    patient = db_session.query(Patient).filter(Patient.id == patient_id).first()
    if patient is None:
        return pd.DataFrame()

    wearables = (
        db_session.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient_id)
        .order_by(WearableDaily.date)
        .all()
    )
    if not wearables:
        return pd.DataFrame()

    rows = []
    for w in wearables:
        rows.append({
            "patient_id": patient_id,
            "date": w.date,
            "sleep_duration": w.sleep_duration,
            "sleep_efficiency": w.sleep_efficiency,
            "sleep_start": w.sleep_start,
            "sleep_end": w.sleep_end,
            "resting_hr": w.resting_hr,
            "avg_hr": w.avg_hr,
            "hrv": w.hrv,
            "steps": w.steps,
            "active_minutes": w.active_minutes,
            "sensor_quality": w.sensor_quality,
        })
    df = pd.DataFrame(rows)
    df = df.sort_values("date").reset_index(drop=True)

    # --- Sleep features ---
    df["sleep_debt_3d"] = df["sleep_duration"].rolling(3, min_periods=1).mean() - 7.0
    df["sleep_debt_7d"] = df["sleep_duration"].rolling(7, min_periods=1).mean() - 7.0
    df["sleep_midpoint"] = (df["sleep_start"] + df["sleep_end"]) / 2.0
    df["sleep_variability_7d"] = df["sleep_duration"].rolling(7, min_periods=2).std().fillna(0.0)

    # --- Cardiovascular features ---
    df["resting_hr_change_1d"] = df["resting_hr"].diff().fillna(0.0)
    hr_roll_7 = df["resting_hr"].rolling(7, min_periods=1).mean()
    df["resting_hr_change_7d"] = df["resting_hr"] - hr_roll_7
    hrv_roll_7 = df["hrv"].rolling(7, min_periods=1).mean()
    df["hrv_change_7d"] = df["hrv"] - hrv_roll_7

    # --- Activity features ---
    steps_roll_7 = df["steps"].rolling(7, min_periods=1).mean()
    df["steps_change_7d"] = df["steps"] - steps_roll_7
    df["activity_variability_7d"] = df["steps"].rolling(7, min_periods=2).std().fillna(0.0)

    # --- Circadian features ---
    df["wake_time_variability_7d"] = df["sleep_end"].rolling(7, min_periods=2).std().fillna(0.0)

    # --- Personal baseline deviations (30-day rolling) ---
    for col, dev_name in [
        ("resting_hr", "resting_hr_dev"),
        ("hrv", "hrv_dev"),
        ("steps", "steps_dev"),
        ("sleep_duration", "sleep_dev"),
        ("active_minutes", "activity_dev"),
    ]:
        roll_mean = df[col].rolling(30, min_periods=7).mean()
        roll_std = df[col].rolling(30, min_periods=7).std().replace(0, np.nan)
        df[dev_name] = (df[col] - roll_mean) / roll_std
        df[dev_name] = df[dev_name].fillna(0.0)

    # --- Static features (constant per patient) ---
    df["age"] = patient.age
    df["sex_encoded"] = 1 if patient.sex == "M" else 0
    df["bmi"] = patient.bmi
    df["diabetes_status"] = int(patient.diabetes_status or False)
    df["hypertension_status"] = int(patient.hypertension_status or False)
    df["dyslipidemia"] = int(patient.dyslipidemia or False)
    df["family_cvd_history"] = int(patient.family_cvd_history or False)
    df["smoking_encoded"] = 1 if patient.smoking_status in ("current", "former") else 0

    # Fill remaining NaNs with column means
    for c in df.columns:
        if df[c].dtype in (np.float64, np.int64, float, int) and df[c].isna().any():
            df[c] = df[c].fillna(df[c].mean())

    return df


def build_all_features(db_session: Session) -> pd.DataFrame:
    patient_ids = [
        pid for (pid,) in db_session.query(Patient.id).all()
    ]
    frames = []
    for pid in patient_ids:
        df = build_features(pid, db_session)
        if not df.empty:
            frames.append(df)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)
