from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.models.database import get_db
from app.models.schemas import (
    Patient, ClinicalHistory, WearableDaily, BPObservation, TwinState, Prediction,
)

router = APIRouter(tags=["patients"])


@router.get("/patients")
def list_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).all()
    result = []
    for p in patients:
        latest_twin = (
            db.query(TwinState)
            .filter(TwinState.patient_id == p.id)
            .order_by(desc(TwinState.timestamp))
            .first()
        )
        result.append({
            "id": p.id,
            "age": p.age,
            "sex": p.sex,
            "bmi": round(p.bmi, 1),
            "hypertension": p.hypertension_status,
            "diabetes": p.diabetes_status,
            "family_cvd": p.family_cvd_history,
            "smoking_status": p.smoking_status,
            "cardiovascular_state": round(latest_twin.cardiovascular_state, 1) if latest_twin else None,
        })
    return result


@router.get("/patients/search")
def search_patients(
    q: Optional[str] = Query(None, description="Search by patient ID"),
    sex: Optional[str] = Query(None),
    min_age: Optional[int] = Query(None),
    max_age: Optional[int] = Query(None),
    hypertension: Optional[bool] = Query(None),
    diabetes: Optional[bool] = Query(None),
    sort_by: str = Query("id", description="Sort field: id, age, bmi"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Patient)

    if q:
        try:
            pid = int(q)
            query = query.filter(Patient.id == pid)
        except ValueError:
            pass

    if sex:
        query = query.filter(Patient.sex == sex.upper())
    if min_age is not None:
        query = query.filter(Patient.age >= min_age)
    if max_age is not None:
        query = query.filter(Patient.age <= max_age)
    if hypertension is not None:
        query = query.filter(Patient.hypertension_status == hypertension)
    if diabetes is not None:
        query = query.filter(Patient.diabetes_status == diabetes)

    total = query.count()

    if sort_by == "age":
        query = query.order_by(Patient.age)
    elif sort_by == "bmi":
        query = query.order_by(Patient.bmi)
    else:
        query = query.order_by(Patient.id)

    patients = query.offset(offset).limit(limit).all()

    result = []
    for p in patients:
        latest_twin = (
            db.query(TwinState)
            .filter(TwinState.patient_id == p.id)
            .order_by(desc(TwinState.timestamp))
            .first()
        )
        latest_bp = (
            db.query(BPObservation)
            .filter(BPObservation.patient_id == p.id)
            .order_by(desc(BPObservation.timestamp))
            .first()
        )
        result.append({
            "id": p.id,
            "age": p.age,
            "sex": p.sex,
            "bmi": round(p.bmi, 1),
            "hypertension": p.hypertension_status,
            "diabetes": p.diabetes_status,
            "family_cvd": p.family_cvd_history,
            "smoking_status": p.smoking_status,
            "dyslipidemia": p.dyslipidemia,
            "cardiovascular_state": round(latest_twin.cardiovascular_state, 1) if latest_twin else None,
            "baseline_deviation": round(latest_twin.baseline_deviation, 1) if latest_twin else None,
            "latest_sbp": latest_bp.systolic_bp if latest_bp else None,
            "latest_dbp": latest_bp.diastolic_bp if latest_bp else None,
        })

    return {"patients": result, "total": total, "limit": limit, "offset": offset}


@router.get("/patients/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    latest_twin = (
        db.query(TwinState)
        .filter(TwinState.patient_id == patient_id)
        .order_by(desc(TwinState.timestamp))
        .first()
    )

    latest_bp = (
        db.query(BPObservation)
        .filter(BPObservation.patient_id == patient_id)
        .order_by(desc(BPObservation.timestamp))
        .first()
    )

    wearable_count = (
        db.query(func.count(WearableDaily.id))
        .filter(WearableDaily.patient_id == patient_id)
        .scalar()
    )

    latest_wearable = (
        db.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient_id)
        .order_by(desc(WearableDaily.date))
        .first()
    )

    data_quality = "Good"
    if latest_wearable:
        sq = latest_wearable.sensor_quality or 0
        if sq < 0.5:
            data_quality = "Low"
        elif sq < 0.8:
            data_quality = "Fair"
    elif wearable_count == 0:
        data_quality = "Low"

    return {
        "id": p.id,
        "age": p.age,
        "sex": p.sex,
        "height_cm": p.height_cm,
        "weight_kg": p.weight_kg,
        "bmi": round(p.bmi, 1),
        "smoking_status": p.smoking_status,
        "diabetes": p.diabetes_status,
        "hypertension": p.hypertension_status,
        "dyslipidemia": p.dyslipidemia,
        "family_cvd": p.family_cvd_history,
        "data_quality": data_quality,
        "wearable_days": wearable_count,
        "twin_state": {
            "autonomic": round(latest_twin.autonomic_state, 1),
            "recovery": round(latest_twin.recovery_state, 1),
            "circadian": round(latest_twin.circadian_state, 1),
            "cardiovascular": round(latest_twin.cardiovascular_state, 1),
            "baseline_deviation": round(latest_twin.baseline_deviation, 1),
            "confidence": round(latest_twin.state_confidence, 2),
        } if latest_twin else None,
        "latest_bp": {
            "systolic": latest_bp.systolic_bp,
            "diastolic": latest_bp.diastolic_bp,
            "timestamp": latest_bp.timestamp.isoformat(),
        } if latest_bp else None,
    }


@router.get("/patients/{patient_id}/baseline")
def get_patient_baseline(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    from app.services.baseline import compute_baselines

    baselines = compute_baselines(patient_id, db)

    latest_wearable = (
        db.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient_id)
        .order_by(desc(WearableDaily.date))
        .first()
    )

    if not latest_wearable:
        return {
            "baselines": baselines,
            "current": None,
            "deviations": None,
        }

    current = {
        "resting_hr": latest_wearable.resting_hr,
        "hrv": latest_wearable.hrv,
        "sleep_duration": round(latest_wearable.sleep_duration, 1) if latest_wearable.sleep_duration else None,
        "steps": latest_wearable.steps,
        "active_minutes": latest_wearable.active_minutes,
        "sleep_efficiency": round(latest_wearable.sleep_efficiency, 1) if latest_wearable.sleep_efficiency else None,
        "date": latest_wearable.date.isoformat(),
    }

    deviations = {}
    mapping = {
        "resting_hr": ("resting_hr_baseline", "resting_hr_std"),
        "hrv": ("hrv_baseline", "hrv_std"),
        "sleep_duration": ("sleep_baseline", "sleep_std"),
        "steps": ("steps_baseline", "steps_std"),
        "active_minutes": ("activity_baseline", "activity_std"),
    }
    for metric, (bl_key, std_key) in mapping.items():
        cur_val = current.get(metric)
        bl_val = baselines.get(bl_key, 0)
        std_val = baselines.get(std_key, 1)
        if cur_val is not None and std_val > 0:
            z = (cur_val - bl_val) / std_val
            deviations[metric] = {
                "current": round(cur_val, 1),
                "baseline": round(bl_val, 1),
                "std": round(std_val, 2),
                "z_score": round(z, 2),
                "direction": "above" if z > 0 else "below" if z < 0 else "normal",
            }

    return {
        "baselines": {k: round(v, 2) for k, v in baselines.items()},
        "current": current,
        "deviations": deviations,
    }


@router.get("/patients/{patient_id}/risk-history")
def get_risk_history(
    patient_id: int,
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    bp_obs = (
        db.query(BPObservation)
        .filter(BPObservation.patient_id == patient_id)
        .order_by(desc(BPObservation.timestamp))
        .limit(days)
        .all()
    )
    bp_obs.reverse()

    twin_states = (
        db.query(TwinState)
        .filter(TwinState.patient_id == patient_id)
        .order_by(desc(TwinState.timestamp))
        .limit(days)
        .all()
    )
    twin_states.reverse()

    twin_by_date = {}
    for ts in twin_states:
        d = ts.timestamp.date().isoformat() if ts.timestamp else None
        if d:
            twin_by_date[d] = {
                "cardiovascular": round(ts.cardiovascular_state, 1),
                "baseline_deviation": round(ts.baseline_deviation, 1),
            }

    bp_timeline = []
    for b in bp_obs:
        d = b.timestamp.date().isoformat() if b.timestamp else b.timestamp.isoformat()[:10]
        elevated = b.systolic_bp >= 140 or b.diastolic_bp >= 90
        twin_info = twin_by_date.get(d, {})
        bp_timeline.append({
            "date": d,
            "systolic": b.systolic_bp,
            "diastolic": b.diastolic_bp,
            "elevated": elevated,
            "cardiovascular_state": twin_info.get("cardiovascular"),
            "baseline_deviation": twin_info.get("baseline_deviation"),
        })

    elevated_count = sum(1 for b in bp_timeline if b["elevated"])
    total = len(bp_timeline)

    return {
        "timeline": bp_timeline,
        "summary": {
            "total_observations": total,
            "elevated_count": elevated_count,
            "elevated_pct": round(elevated_count / total * 100, 1) if total > 0 else 0,
            "avg_systolic": round(sum(b["systolic"] for b in bp_timeline) / total, 1) if total > 0 else None,
            "avg_diastolic": round(sum(b["diastolic"] for b in bp_timeline) / total, 1) if total > 0 else None,
            "max_systolic": max((b["systolic"] for b in bp_timeline), default=None),
            "min_systolic": min((b["systolic"] for b in bp_timeline), default=None),
        },
    }


@router.get("/patients/{patient_id}/history")
def get_patient_history(patient_id: int, db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")

    clinical = (
        db.query(ClinicalHistory)
        .filter(ClinicalHistory.patient_id == patient_id)
        .order_by(ClinicalHistory.measurement_date)
        .all()
    )

    wearable = (
        db.query(WearableDaily)
        .filter(WearableDaily.patient_id == patient_id)
        .order_by(WearableDaily.date)
        .all()
    )

    bp = (
        db.query(BPObservation)
        .filter(BPObservation.patient_id == patient_id)
        .order_by(BPObservation.timestamp)
        .all()
    )

    return {
        "clinical": [
            {
                "date": c.measurement_date.isoformat(),
                "systolic_bp": c.systolic_bp,
                "diastolic_bp": c.diastolic_bp,
                "resting_hr": c.resting_hr,
                "glucose": c.glucose,
                "hba1c": c.hba1c,
                "creatinine": c.creatinine,
                "ldl": c.ldl,
                "medication": c.medication_flag,
            }
            for c in clinical
        ],
        "wearable": [
            {
                "date": w.date.isoformat(),
                "avg_hr": w.avg_hr,
                "resting_hr": w.resting_hr,
                "hrv": w.hrv,
                "steps": w.steps,
                "active_minutes": w.active_minutes,
                "sleep_duration": round(w.sleep_duration, 1),
                "sleep_efficiency": round(w.sleep_efficiency, 1),
                "sensor_quality": w.sensor_quality,
            }
            for w in wearable
        ],
        "bp_observations": [
            {
                "timestamp": b.timestamp.isoformat(),
                "systolic": b.systolic_bp,
                "diastolic": b.diastolic_bp,
                "source": b.measurement_source,
            }
            for b in bp
        ],
    }
