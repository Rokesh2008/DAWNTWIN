from __future__ import annotations

import joblib
import numpy as np
import pandas as pd

from app.config import MODEL_DIR
from app.services.feature_engine import build_features
from app.services.baseline import compute_baselines
from app.services.twin_engine import get_latest_twin_state
from app.services.forecast import TWIN_STATE_FEATURES
from app.models.schemas import Patient


SLEEP_FEATURES = [
    "sleep_duration", "sleep_efficiency", "sleep_debt_3d", "sleep_debt_7d", "sleep_dev",
]

ACTIVITY_FEATURES = [
    "steps", "active_minutes", "steps_dev", "activity_dev",
]


def simulate_scenarios(patient_id: int, db_session) -> list[dict]:
    """Run what-if simulations by perturbing physiological features to baseline values."""
    model_path = MODEL_DIR / "forecast_model.joblib"
    names_path = MODEL_DIR / "feature_names.joblib"

    if not model_path.exists():
        raise RuntimeError("Model not trained yet. Call /api/model/train first.")

    model = joblib.load(model_path)
    feature_names: list[str] = joblib.load(names_path)

    features_df = build_features(patient_id, db_session)
    if features_df.empty:
        raise ValueError(f"No wearable data for patient {patient_id}")

    latest = features_df.sort_values("date").iloc[-1:]

    twin = get_latest_twin_state(patient_id, db_session)
    if twin:
        for col in TWIN_STATE_FEATURES:
            latest[col] = getattr(twin, col, 50.0)
    else:
        for col in TWIN_STATE_FEATURES:
            latest[col] = 50.0

    patient = db_session.query(Patient).filter_by(id=patient_id).first()
    if patient:
        latest["age"] = patient.age
        latest["sex_encoded"] = 1 if patient.sex == "M" else 0
        latest["bmi"] = patient.bmi
        latest["diabetes_status"] = int(patient.diabetes_status or False)
        latest["hypertension_status"] = int(patient.hypertension_status or False)
        latest["dyslipidemia"] = int(patient.dyslipidemia or False)
        latest["family_cvd_history"] = int(patient.family_cvd_history or False)
        latest["smoking_encoded"] = 1 if patient.smoking_status in ("current", "former") else 0

    for col in feature_names:
        if col not in latest.columns:
            latest[col] = 0.0

    X_current = latest[feature_names].fillna(0.0)
    current_risk = float(model.predict_proba(X_current)[:, 1][0])

    baselines = compute_baselines(patient_id, db_session)

    sbp_model_path = MODEL_DIR / "regression_sbp.joblib"
    reg_sbp = joblib.load(sbp_model_path) if sbp_model_path.exists() else None

    if reg_sbp is not None:
        reg_feat = getattr(reg_sbp, "feature_names_in_", None)
        if reg_feat is not None:
            reg_avail = [c for c in reg_feat if c in X_current.columns]
        else:
            reg_avail = [c for c in feature_names if c in X_current.columns and c not in TWIN_STATE_FEATURES]
    else:
        reg_avail = []

    current_sbp = None
    if reg_sbp is not None and reg_avail:
        current_sbp = float(reg_sbp.predict(X_current[reg_avail])[0])

    scenarios = [
        {
            "name": "Current trajectory",
            "modifications": {},
        },
        {
            "name": "Restore usual sleep",
            "modifications": _sleep_restore(baselines),
        },
        {
            "name": "Restore usual activity",
            "modifications": _activity_restore(baselines),
        },
        {
            "name": "Combined recovery",
            "modifications": {**_sleep_restore(baselines), **_activity_restore(baselines)},
        },
    ]

    results = []
    for scenario in scenarios:
        X_mod = X_current.copy()
        for feat, val in scenario["modifications"].items():
            if feat in X_mod.columns:
                X_mod[feat] = val

        risk = float(model.predict_proba(X_mod)[:, 1][0])

        pred_sbp = None
        if reg_sbp is not None and reg_avail:
            pred_sbp = float(reg_sbp.predict(X_mod[reg_avail])[0])

        results.append({
            "scenario_name": scenario["name"],
            "risk_probability": round(risk, 4),
            "predicted_sbp": round(pred_sbp, 1) if pred_sbp is not None else None,
            "delta_risk": round(risk - current_risk, 4),
            "delta_sbp": round(pred_sbp - current_sbp, 1) if (pred_sbp and current_sbp) else None,
        })

    return results


def _sleep_restore(baselines: dict) -> dict:
    mods = {}
    if "sleep_baseline" in baselines:
        mods["sleep_duration"] = baselines["sleep_baseline"]
    mods["sleep_debt_3d"] = 0.0
    mods["sleep_debt_7d"] = 0.0
    mods["sleep_dev"] = 0.0
    return mods


def _activity_restore(baselines: dict) -> dict:
    mods = {}
    if "steps_baseline" in baselines:
        mods["steps"] = baselines["steps_baseline"]
    if "activity_baseline" in baselines:
        mods["active_minutes"] = baselines["activity_baseline"]
    mods["steps_dev"] = 0.0
    mods["activity_dev"] = 0.0
    return mods
