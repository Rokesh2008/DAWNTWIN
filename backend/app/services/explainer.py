from __future__ import annotations

import joblib
import numpy as np

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

from app.config import MODEL_DIR
from app.services.feature_engine import build_features
from app.services.twin_engine import get_latest_twin_state
from app.services.forecast import TWIN_STATE_FEATURES
from app.models.schemas import Patient


FEATURE_LABELS: dict[str, str] = {
    "sleep_duration": "Sleep duration",
    "sleep_efficiency": "Sleep efficiency",
    "sleep_debt_3d": "3-day sleep deficit",
    "sleep_debt_7d": "7-day sleep deficit",
    "sleep_midpoint": "Sleep midpoint",
    "sleep_variability_7d": "Sleep variability",
    "resting_hr": "Resting heart rate",
    "resting_hr_change_1d": "Resting HR change (1-day)",
    "resting_hr_change_7d": "Resting HR trend (7-day)",
    "hrv": "Heart rate variability",
    "hrv_change_7d": "HRV trend (7-day)",
    "steps": "Daily steps",
    "steps_change_7d": "Activity trend (7-day)",
    "active_minutes": "Active minutes",
    "activity_variability_7d": "Activity variability",
    "sleep_start": "Sleep start time",
    "sleep_end": "Wake time",
    "wake_time_variability_7d": "Wake-time variability",
    "sleep_dev": "Sleep vs personal baseline",
    "resting_hr_dev": "Resting HR vs baseline",
    "hrv_dev": "HRV vs baseline",
    "steps_dev": "Steps vs baseline",
    "activity_dev": "Activity vs baseline",
    "autonomic_state": "Autonomic state",
    "recovery_state": "Recovery state",
    "circadian_state": "Circadian stability",
    "cardiovascular_state": "Cardiovascular state",
    "baseline_deviation": "Baseline deviation",
    "bmi": "BMI",
    "age": "Age",
    "sex_encoded": "Sex",
    "hypertension_status": "Hypertension history",
    "diabetes_status": "Diabetes",
    "dyslipidemia": "Dyslipidemia",
    "family_cvd_history": "Family CVD history",
    "smoking_encoded": "Smoking status",
}


def explain_prediction(patient_id: int, db_session, top_n: int = 5) -> list[dict]:
    """Return top drivers of the prediction for a patient, using SHAP values."""
    model_path = MODEL_DIR / "forecast_model_raw.joblib"
    names_path = MODEL_DIR / "feature_names.joblib"

    if not model_path.exists():
        raise RuntimeError("Model not trained yet. Call /api/model/train first.")

    raw_model = joblib.load(model_path)
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

    X = latest[feature_names].fillna(0.0)

    if HAS_SHAP:
        try:
            explainer = shap.TreeExplainer(raw_model)
        except Exception:
            explainer = shap.LinearExplainer(raw_model, X)

        shap_values = explainer.shap_values(X)

        if isinstance(shap_values, list):
            sv = shap_values[1][0]
        elif shap_values.ndim == 2:
            sv = shap_values[0]
        else:
            sv = shap_values
    else:
        fi = getattr(raw_model, "feature_importances_", None)
        if fi is not None:
            mean_val = X.iloc[0].values
            sv = fi * np.sign(mean_val - np.median(mean_val))
        else:
            sv = np.zeros(len(feature_names))

    abs_sv = np.abs(sv)
    total = abs_sv.sum() if abs_sv.sum() > 0 else 1.0

    indexed = list(zip(feature_names, sv, abs_sv))
    indexed.sort(key=lambda x: x[2], reverse=True)

    drivers = []
    for feat, val, abs_val in indexed[:top_n]:
        drivers.append({
            "feature": feat,
            "label": FEATURE_LABELS.get(feat, feat.replace("_", " ").title()),
            "shap_value": round(float(val), 4),
            "direction": "increasing" if val > 0 else "decreasing",
            "contribution_pct": round(float(abs_val / total * 100), 1),
        })

    return drivers
