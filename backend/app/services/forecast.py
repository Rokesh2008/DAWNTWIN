from __future__ import annotations

import json
import joblib
import numpy as np
import pandas as pd
from datetime import timedelta
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
)
from xgboost import XGBClassifier, XGBRegressor

from app.config import (
    MODEL_DIR,
    RANDOM_SEED,
    TRAIN_RATIO,
    VAL_RATIO,
    SBP_THRESHOLD,
    DBP_THRESHOLD,
)
from app.services.feature_engine import build_features, build_all_features
from app.services.baseline import compute_baselines
from app.services.twin_engine import get_latest_twin_state
from app.models.schemas import BPObservation, TwinState, Patient


# ---------------------------------------------------------------------------
# Feature subset definitions for ablation
# ---------------------------------------------------------------------------

EHR_FEATURES = [
    "age", "sex_encoded", "bmi", "diabetes_status", "hypertension_status",
    "dyslipidemia", "family_cvd_history", "smoking_encoded",
]

WEARABLE_FEATURES = [
    "sleep_duration", "sleep_efficiency", "sleep_debt_3d", "sleep_debt_7d",
    "sleep_midpoint", "sleep_variability_7d",
    "resting_hr", "resting_hr_change_1d", "resting_hr_change_7d",
    "hrv", "hrv_change_7d",
    "steps", "steps_change_7d", "active_minutes", "activity_variability_7d",
    "sleep_start", "sleep_end", "wake_time_variability_7d",
]

PERSONALIZATION_FEATURES = [
    "sleep_dev", "resting_hr_dev", "hrv_dev", "steps_dev", "activity_dev",
]

TWIN_STATE_FEATURES = [
    "autonomic_state", "recovery_state", "circadian_state",
    "cardiovascular_state", "baseline_deviation",
]


# ---------------------------------------------------------------------------
# Data preparation
# ---------------------------------------------------------------------------

def prepare_training_data(db_session) -> dict:
    """Build feature matrix, target vector, and patient-level train/val/test split."""
    features_df = build_all_features(db_session)

    bp_rows = (
        db_session.query(BPObservation)
        .order_by(BPObservation.patient_id, BPObservation.timestamp)
        .all()
    )
    bp_df = pd.DataFrame(
        [
            {
                "patient_id": r.patient_id,
                "bp_date": r.timestamp.date(),
                "systolic_bp": r.systolic_bp,
                "diastolic_bp": r.diastolic_bp,
            }
            for r in bp_rows
        ]
    )

    bp_df["elevated"] = (
        (bp_df["systolic_bp"] >= SBP_THRESHOLD)
        | (bp_df["diastolic_bp"] >= DBP_THRESHOLD)
    ).astype(int)

    target = bp_df.groupby(["patient_id", "bp_date"])["elevated"].max().reset_index()
    target.rename(columns={"bp_date": "target_date"}, inplace=True)

    features_df["target_date"] = features_df["date"] + timedelta(days=1)
    merged = features_df.merge(target, on=["patient_id", "target_date"], how="inner")

    twin_rows = db_session.query(TwinState).all()
    if twin_rows:
        twin_df = pd.DataFrame(
            [
                {
                    "patient_id": r.patient_id,
                    "twin_date": r.timestamp.date(),
                    "autonomic_state": r.autonomic_state,
                    "recovery_state": r.recovery_state,
                    "circadian_state": r.circadian_state,
                    "cardiovascular_state": r.cardiovascular_state,
                    "baseline_deviation": r.baseline_deviation,
                }
                for r in twin_rows
            ]
        )
        merged = merged.merge(
            twin_df,
            left_on=["patient_id", "date"],
            right_on=["patient_id", "twin_date"],
            how="left",
        )
        for col in TWIN_STATE_FEATURES:
            if col not in merged.columns:
                merged[col] = 50.0
    else:
        for col in TWIN_STATE_FEATURES:
            merged[col] = 50.0

    patient_ids = merged["patient_id"].unique()
    rng = np.random.RandomState(RANDOM_SEED)
    rng.shuffle(patient_ids)

    n = len(patient_ids)
    n_train = int(n * TRAIN_RATIO)
    n_val = int(n * VAL_RATIO)

    train_ids = set(patient_ids[:n_train])
    val_ids = set(patient_ids[n_train : n_train + n_val])
    test_ids = set(patient_ids[n_train + n_val :])

    feature_cols = _get_all_feature_cols(merged)

    train_mask = merged["patient_id"].isin(train_ids)
    val_mask = merged["patient_id"].isin(val_ids)
    test_mask = merged["patient_id"].isin(test_ids)

    for col in feature_cols:
        if col not in merged.columns:
            merged[col] = 0.0

    merged[feature_cols] = merged[feature_cols].fillna(0.0)

    return {
        "X_train": merged.loc[train_mask, feature_cols],
        "y_train": merged.loc[train_mask, "elevated"],
        "X_val": merged.loc[val_mask, feature_cols],
        "y_val": merged.loc[val_mask, "elevated"],
        "X_test": merged.loc[test_mask, feature_cols],
        "y_test": merged.loc[test_mask, "elevated"],
        "feature_names": feature_cols,
        "split_info": {
            "train_patients": len(train_ids),
            "val_patients": len(val_ids),
            "test_patients": len(test_ids),
            "train_rows": int(train_mask.sum()),
            "val_rows": int(val_mask.sum()),
            "test_rows": int(test_mask.sum()),
        },
    }


def _get_all_feature_cols(df: pd.DataFrame) -> list[str]:
    meta_cols = {
        "patient_id", "date", "target_date", "elevated", "twin_date",
        "systolic_bp", "diastolic_bp", "bp_date",
    }
    all_desired = EHR_FEATURES + WEARABLE_FEATURES + PERSONALIZATION_FEATURES + TWIN_STATE_FEATURES
    return [c for c in all_desired if c in df.columns or c in all_desired]


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------

def evaluate_model(model, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    ece = _expected_calibration_error(y_test.values, y_prob)

    return {
        "auroc": float(roc_auc_score(y_test, y_prob)),
        "auprc": float(average_precision_score(y_test, y_prob)),
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
        "brier_score": float(brier_score_loss(y_test, y_prob)),
        "ece": float(ece),
        "n_samples": len(y_test),
        "n_positive": int(y_test.sum()),
    }


def _expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    bin_edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        mask = (y_prob >= lo) & (y_prob < hi)
        if mask.sum() == 0:
            continue
        bin_acc = y_true[mask].mean()
        bin_conf = y_prob[mask].mean()
        ece += mask.sum() / len(y_true) * abs(bin_acc - bin_conf)
    return ece


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_models(db_session=None) -> dict:
    """Train LR + XGBoost classifiers and a regression model. Return metrics."""
    if db_session is None:
        from app.models.database import SessionLocal
        db_session = SessionLocal()
        own_session = True
    else:
        own_session = False

    try:
        data = prepare_training_data(db_session)
        X_train, y_train = data["X_train"], data["y_train"]
        X_val, y_val = data["X_val"], data["y_val"]
        X_test, y_test = data["X_test"], data["y_test"]
        feature_names = data["feature_names"]

        pos_weight = max((y_train == 0).sum() / max((y_train == 1).sum(), 1), 1.0)

        lr = LogisticRegression(C=1.0, max_iter=1000, class_weight="balanced", random_state=RANDOM_SEED)
        lr.fit(X_train, y_train)

        xgb = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            scale_pos_weight=pos_weight,
            random_state=RANDOM_SEED,
            eval_metric="logloss",
                    )
        xgb.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

        lr_cal = CalibratedClassifierCV(lr, method="isotonic", cv=3)
        lr_cal.fit(X_train, y_train)

        xgb_cal = CalibratedClassifierCV(xgb, method="isotonic", cv=3)
        xgb_cal.fit(X_train, y_train)

        lr_metrics = evaluate_model(lr_cal, X_test, y_test)
        xgb_metrics = evaluate_model(xgb_cal, X_test, y_test)

        if xgb_metrics["auroc"] >= lr_metrics["auroc"]:
            best_model = xgb_cal
            best_name = "xgboost"
            best_metrics = xgb_metrics
            raw_model = xgb
        else:
            best_model = lr_cal
            best_name = "logistic_regression"
            best_metrics = lr_metrics
            raw_model = lr

        joblib.dump(best_model, MODEL_DIR / "forecast_model.joblib")
        joblib.dump(raw_model, MODEL_DIR / "forecast_model_raw.joblib")
        joblib.dump(feature_names, MODEL_DIR / "feature_names.joblib")

        reg = XGBRegressor(
            n_estimators=150,
            max_depth=4,
            learning_rate=0.1,
            random_state=RANDOM_SEED,
        )

        bp_obs = db_session.query(BPObservation).all()
        bp_df = pd.DataFrame(
            [{"patient_id": r.patient_id, "bp_date": r.timestamp.date(),
              "systolic_bp": r.systolic_bp, "diastolic_bp": r.diastolic_bp}
             for r in bp_obs]
        )
        target_sbp = bp_df.groupby(["patient_id", "bp_date"])["systolic_bp"].mean().reset_index()
        target_sbp.rename(columns={"bp_date": "target_date"}, inplace=True)
        target_dbp = bp_df.groupby(["patient_id", "bp_date"])["diastolic_bp"].mean().reset_index()
        target_dbp.rename(columns={"bp_date": "target_date"}, inplace=True)

        features_df = build_all_features(db_session)
        features_df["target_date"] = features_df["date"] + timedelta(days=1)

        reg_merged = features_df.merge(target_sbp, on=["patient_id", "target_date"], how="inner")
        reg_merged = reg_merged.merge(
            target_dbp[["patient_id", "target_date", "diastolic_bp"]],
            on=["patient_id", "target_date"],
            how="inner",
        )

        avail_features = [c for c in feature_names if c in reg_merged.columns]
        for c in avail_features:
            reg_merged[c] = reg_merged[c].fillna(0.0)

        if len(reg_merged) > 10:
            reg_sbp = XGBRegressor(n_estimators=150, max_depth=4, learning_rate=0.1, random_state=RANDOM_SEED)
            reg_sbp.fit(reg_merged[avail_features], reg_merged["systolic_bp"])

            reg_dbp = XGBRegressor(n_estimators=150, max_depth=4, learning_rate=0.1, random_state=RANDOM_SEED)
            reg_dbp.fit(reg_merged[avail_features], reg_merged["diastolic_bp"])

            joblib.dump(reg_sbp, MODEL_DIR / "regression_sbp.joblib")
            joblib.dump(reg_dbp, MODEL_DIR / "regression_dbp.joblib")

        ablation = run_ablation(db_session)

        metrics_result = {
            "best_model": best_name,
            "best_metrics": best_metrics,
            "lr_metrics": lr_metrics,
            "xgb_metrics": xgb_metrics,
            "split_info": data["split_info"],
            "feature_count": len(feature_names),
            "ablation": ablation,
        }

        with open(MODEL_DIR / "metrics.json", "w") as f:
            json.dump(metrics_result, f, indent=2)

        return metrics_result
    finally:
        if own_session:
            db_session.close()


# ---------------------------------------------------------------------------
# Ablation study
# ---------------------------------------------------------------------------

def run_ablation(db_session) -> list[dict]:
    data = prepare_training_data(db_session)
    X_train, y_train = data["X_train"], data["y_train"]
    X_test, y_test = data["X_test"], data["y_test"]

    subsets = {
        "EHR only": [c for c in EHR_FEATURES if c in X_train.columns],
        "Wearable only": [c for c in WEARABLE_FEATURES if c in X_train.columns],
        "EHR + Wearable": [c for c in EHR_FEATURES + WEARABLE_FEATURES if c in X_train.columns],
        "DAWNTWIN (full)": list(X_train.columns),
    }

    results = []
    for name, cols in subsets.items():
        if not cols:
            continue
        model = XGBClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.1,
            random_state=RANDOM_SEED, eval_metric="logloss",         )
        model.fit(X_train[cols], y_train, verbose=False)
        cal = CalibratedClassifierCV(model, method="isotonic", cv=3)
        cal.fit(X_train[cols], y_train)
        metrics = evaluate_model(cal, X_test[cols], y_test)
        results.append({"name": name, **metrics})

    return results


# ---------------------------------------------------------------------------
# Single-patient prediction
# ---------------------------------------------------------------------------

def predict(patient_id: int, db_session) -> dict:
    model_path = MODEL_DIR / "forecast_model.joblib"
    names_path = MODEL_DIR / "feature_names.joblib"

    if not model_path.exists():
        raise RuntimeError("Model not trained yet. Call /api/model/train first.")

    model = joblib.load(model_path)
    feature_names = joblib.load(names_path)

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
    risk_prob = float(model.predict_proba(X)[:, 1][0])

    if risk_prob < 0.3:
        risk_level = "Low"
    elif risk_prob < 0.5:
        risk_level = "Moderate"
    elif risk_prob < 0.7:
        risk_level = "High"
    else:
        risk_level = "Critical"

    state_confidence = twin.state_confidence if twin else 0.7
    confidence = state_confidence * 0.9

    predicted_sbp, predicted_dbp = 125.0, 82.0
    sbp_model_path = MODEL_DIR / "regression_sbp.joblib"
    dbp_model_path = MODEL_DIR / "regression_dbp.joblib"
    if sbp_model_path.exists() and dbp_model_path.exists():
        reg_sbp = joblib.load(sbp_model_path)
        reg_dbp = joblib.load(dbp_model_path)
        reg_features = getattr(reg_sbp, "feature_names_in_", None)
        if reg_features is not None:
            avail = [c for c in reg_features if c in X.columns]
        else:
            avail = [c for c in feature_names if c in X.columns and c not in TWIN_STATE_FEATURES]
        if avail:
            predicted_sbp = float(reg_sbp.predict(X[avail])[0])
            predicted_dbp = float(reg_dbp.predict(X[avail])[0])

    uncertainty = max(1.0 - confidence, 0.3)
    margin_sbp = 10.0 * uncertainty
    margin_dbp = 7.0 * uncertainty

    return {
        "risk_probability": round(risk_prob, 4),
        "risk_level": risk_level,
        "predicted_sbp": round(predicted_sbp, 1),
        "predicted_dbp": round(predicted_dbp, 1),
        "lower_sbp": round(predicted_sbp - margin_sbp, 1),
        "upper_sbp": round(predicted_sbp + margin_sbp, 1),
        "lower_dbp": round(predicted_dbp - margin_dbp, 1),
        "upper_dbp": round(predicted_dbp + margin_dbp, 1),
        "confidence": round(confidence, 3),
        "feature_values": {k: round(float(v), 4) for k, v in X.iloc[0].items()},
    }
