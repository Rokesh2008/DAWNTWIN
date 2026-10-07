from datetime import datetime, timezone
import numpy as np
from sqlalchemy.orm import Session

from app.config import TWIN_ALPHA
from app.models.schemas import Patient, TwinState
from app.services.feature_engine import build_features
from app.services.baseline import compute_baselines


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def compute_twin_states(patient_id: int, db_session: Session) -> list[dict]:
    features = build_features(patient_id, db_session)
    if features.empty:
        return []
    baselines = compute_baselines(patient_id, db_session)

    alpha = TWIN_ALPHA
    prev = {"autonomic": 50.0, "recovery": 50.0, "circadian": 80.0, "cardiovascular": 50.0}
    states = []

    for _, row in features.iterrows():
        hrv_dev = row.get("hrv_dev", 0.0)
        rhr_dev = row.get("resting_hr_dev", 0.0)
        sleep_dev = row.get("sleep_dev", 0.0)
        sleep_eff = row.get("sleep_efficiency", 80.0)
        sleep_debt_3d = row.get("sleep_debt_3d", 0.0)
        wake_var = row.get("wake_time_variability_7d", 0.0)
        rhr_change_7d = row.get("resting_hr_change_7d", 0.0)
        sensor_q = row.get("sensor_quality", 1.0)

        raw_autonomic = 50.0 + 25.0 * hrv_dev - 25.0 * rhr_dev
        raw_autonomic = _clamp(raw_autonomic)

        raw_recovery = 50.0 + 20.0 * sleep_dev + 15.0 * (sleep_eff / 100.0 - 0.8) * 5.0 - 15.0 * (sleep_debt_3d / 2.0)
        raw_recovery = _clamp(raw_recovery)

        raw_circadian = 80.0 - 20.0 * wake_var
        raw_circadian = _clamp(raw_circadian)

        raw_cardiovascular = (
            0.3 * raw_autonomic
            + 0.3 * raw_recovery
            + 0.2 * raw_circadian
            + 0.2 * (50.0 - 10.0 * rhr_change_7d)
        )
        raw_cardiovascular = _clamp(raw_cardiovascular)

        autonomic = alpha * raw_autonomic + (1 - alpha) * prev["autonomic"]
        recovery = alpha * raw_recovery + (1 - alpha) * prev["recovery"]
        circadian = alpha * raw_circadian + (1 - alpha) * prev["circadian"]
        cardiovascular = alpha * raw_cardiovascular + (1 - alpha) * prev["cardiovascular"]

        healthy_ref = np.array([75.0, 75.0, 75.0, 75.0])
        current = np.array([autonomic, recovery, circadian, cardiovascular])
        baseline_deviation = float(np.linalg.norm(current - healthy_ref) / np.linalg.norm(healthy_ref) * 100.0)
        baseline_deviation = _clamp(baseline_deviation)

        state_confidence = float(sensor_q) if sensor_q is not None else 0.5

        states.append({
            "patient_id": patient_id,
            "date": row["date"],
            "autonomic_state": round(autonomic, 1),
            "recovery_state": round(recovery, 1),
            "circadian_state": round(circadian, 1),
            "cardiovascular_state": round(cardiovascular, 1),
            "baseline_deviation": round(baseline_deviation, 1),
            "state_confidence": round(state_confidence, 2),
        })

        prev = {
            "autonomic": autonomic,
            "recovery": recovery,
            "circadian": circadian,
            "cardiovascular": cardiovascular,
        }

    return states


def get_latest_twin_state(patient_id: int, db_session: Session):
    from sqlalchemy import desc
    return (
        db_session.query(TwinState)
        .filter(TwinState.patient_id == patient_id)
        .order_by(desc(TwinState.timestamp))
        .first()
    )


def update_twin_states(patient_id: int, db_session: Session) -> None:
    states = compute_twin_states(patient_id, db_session)
    if not states:
        return

    db_session.query(TwinState).filter(TwinState.patient_id == patient_id).delete()

    for s in states:
        ts = TwinState(
            patient_id=s["patient_id"],
            timestamp=datetime.combine(s["date"], datetime.min.time(), tzinfo=timezone.utc),
            autonomic_state=s["autonomic_state"],
            recovery_state=s["recovery_state"],
            circadian_state=s["circadian_state"],
            cardiovascular_state=s["cardiovascular_state"],
            baseline_deviation=s["baseline_deviation"],
            state_confidence=s["state_confidence"],
        )
        db_session.add(ts)

    db_session.commit()


def update_all_twins(db_session: Session) -> None:
    patient_ids = [
        pid for (pid,) in db_session.query(Patient.id).all()
    ]
    for pid in patient_ids:
        update_twin_states(pid, db_session)
