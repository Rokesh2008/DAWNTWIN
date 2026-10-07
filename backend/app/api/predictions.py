from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.schemas import Patient, Prediction

router = APIRouter(tags=["predictions"])


@router.post("/patients/{patient_id}/predict")
def predict_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    from app.services.forecast import predict
    from app.services.explainer import explain_prediction

    result = predict(patient_id, db)
    drivers = explain_prediction(patient_id, db)

    return {
        "risk_probability": round(result["risk_probability"], 3),
        "predicted_sbp": round(result["predicted_sbp"], 1),
        "predicted_dbp": round(result["predicted_dbp"], 1),
        "lower_sbp": round(result["lower_sbp"], 1),
        "upper_sbp": round(result["upper_sbp"], 1),
        "lower_dbp": round(result["lower_dbp"], 1),
        "upper_dbp": round(result["upper_dbp"], 1),
        "risk_level": result["risk_level"],
        "confidence": round(result["confidence"], 2),
        "risk_window": {"start": "06:30", "end": "09:00"},
        "drivers": drivers,
    }


@router.post("/patients/{patient_id}/simulate")
def simulate_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    from app.services.simulator import simulate_scenarios

    scenarios = simulate_scenarios(patient_id, db)
    return {"scenarios": scenarios}


@router.get("/patients/{patient_id}/predictions")
def get_predictions(patient_id: int, db: Session = Depends(get_db)):
    preds = (
        db.query(Prediction)
        .filter(Prediction.patient_id == patient_id)
        .order_by(desc(Prediction.prediction_time))
        .limit(30)
        .all()
    )

    return [
        {
            "id": p.id,
            "prediction_time": p.prediction_time.isoformat(),
            "target_date": p.target_date.isoformat(),
            "risk_probability": round(p.risk_probability, 3),
            "predicted_sbp": p.predicted_sbp,
            "predicted_dbp": p.predicted_dbp,
            "risk_level": p.risk_level,
            "confidence": p.confidence,
            "drivers": [p.top_driver_1, p.top_driver_2, p.top_driver_3],
        }
        for p in preds
    ]


@router.post("/data/seed")
def seed_data():
    from app.data.seed import seed_database
    seed_database()
    return {"status": "ok", "message": "Synthetic data generated"}


@router.post("/model/train")
def train_model():
    from app.services.forecast import train_models
    from app.models.database import SessionLocal
    db = SessionLocal()
    try:
        metrics = train_models(db)
        return {"status": "ok", "metrics": metrics}
    finally:
        db.close()


@router.get("/model/metrics")
def get_metrics():
    import json
    from app.config import MODEL_DIR
    metrics_path = MODEL_DIR / "metrics.json"
    if not metrics_path.exists():
        raise HTTPException(status_code=404, detail="Model not trained yet")
    with open(metrics_path) as f:
        return json.load(f)
