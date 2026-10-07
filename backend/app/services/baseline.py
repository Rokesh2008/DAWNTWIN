from sqlalchemy.orm import Session
from app.models.schemas import Patient, WearableDaily
import pandas as pd
import numpy as np


def compute_baselines(patient_id: int, db_session: Session) -> dict:
    wearables = (
        db_session.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient_id)
        .order_by(WearableDaily.date.desc())
        .limit(30)
        .all()
    )
    if not wearables:
        return _default_baselines()

    resting_hrs = [w.resting_hr for w in wearables if w.resting_hr is not None]
    hrvs = [w.hrv for w in wearables if w.hrv is not None]
    sleeps = [w.sleep_duration for w in wearables if w.sleep_duration is not None]
    steps_list = [w.steps for w in wearables if w.steps is not None]
    actives = [w.active_minutes for w in wearables if w.active_minutes is not None]

    def _safe_mean(vals):
        return float(np.mean(vals)) if vals else 0.0

    def _safe_std(vals):
        return float(np.std(vals, ddof=1)) if len(vals) > 1 else 1.0

    return {
        "resting_hr_baseline": _safe_mean(resting_hrs),
        "hrv_baseline": _safe_mean(hrvs),
        "sleep_baseline": _safe_mean(sleeps),
        "steps_baseline": _safe_mean(steps_list),
        "activity_baseline": _safe_mean(actives),
        "resting_hr_std": _safe_std(resting_hrs),
        "hrv_std": _safe_std(hrvs),
        "sleep_std": _safe_std(sleeps),
        "steps_std": _safe_std(steps_list),
        "activity_std": _safe_std(actives),
    }


def _default_baselines() -> dict:
    return {
        "resting_hr_baseline": 70.0,
        "hrv_baseline": 45.0,
        "sleep_baseline": 7.0,
        "steps_baseline": 7000.0,
        "activity_baseline": 30.0,
        "resting_hr_std": 5.0,
        "hrv_std": 10.0,
        "sleep_std": 1.0,
        "steps_std": 2000.0,
        "activity_std": 10.0,
    }


def compute_all_baselines(db_session: Session) -> pd.DataFrame:
    patient_ids = [
        pid for (pid,) in db_session.query(Patient.id).all()
    ]
    rows = []
    for pid in patient_ids:
        bl = compute_baselines(pid, db_session)
        bl["patient_id"] = pid
        rows.append(bl)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows).set_index("patient_id")
    return df
