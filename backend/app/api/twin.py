from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.schemas import Patient, TwinState

router = APIRouter(tags=["twin"])


@router.get("/patients/{patient_id}/twin")
def get_twin_state(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    states = (
        db.query(TwinState)
        .filter(TwinState.patient_id == patient_id)
        .order_by(TwinState.timestamp)
        .all()
    )

    if not states:
        raise HTTPException(status_code=404, detail="No twin state data")

    latest = states[-1]
    trajectory = [
        {
            "date": s.timestamp.isoformat()[:10],
            "autonomic": round(s.autonomic_state, 1),
            "recovery": round(s.recovery_state, 1),
            "circadian": round(s.circadian_state, 1),
            "cardiovascular": round(s.cardiovascular_state, 1),
            "baseline_deviation": round(s.baseline_deviation, 1),
            "confidence": round(s.state_confidence, 2),
        }
        for s in states[-7:]
    ]

    return {
        "current": {
            "autonomic": round(latest.autonomic_state, 1),
            "recovery": round(latest.recovery_state, 1),
            "circadian": round(latest.circadian_state, 1),
            "cardiovascular": round(latest.cardiovascular_state, 1),
            "baseline_deviation": round(latest.baseline_deviation, 1),
            "confidence": round(latest.state_confidence, 2),
        },
        "trajectory": trajectory,
    }
