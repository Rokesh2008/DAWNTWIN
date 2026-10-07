from sqlalchemy import Column, Integer, Float, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.models.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    age = Column(Integer, nullable=False)
    sex = Column(String(1), nullable=False)
    height_cm = Column(Float)
    weight_kg = Column(Float)
    bmi = Column(Float, nullable=False)
    smoking_status = Column(String(20), default="never")
    diabetes_status = Column(Boolean, default=False)
    hypertension_status = Column(Boolean, default=False)
    dyslipidemia = Column(Boolean, default=False)
    family_cvd_history = Column(Boolean, default=False)

    clinical_history = relationship("ClinicalHistory", back_populates="patient")
    wearable_daily = relationship("WearableDaily", back_populates="patient")
    bp_observations = relationship("BPObservation", back_populates="patient")
    twin_states = relationship("TwinState", back_populates="patient")
    predictions = relationship("Prediction", back_populates="patient")


class ClinicalHistory(Base):
    __tablename__ = "clinical_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    measurement_date = Column(Date, nullable=False)
    systolic_bp = Column(Float)
    diastolic_bp = Column(Float)
    resting_hr = Column(Float)
    glucose = Column(Float)
    hba1c = Column(Float)
    creatinine = Column(Float)
    ldl = Column(Float)
    medication_flag = Column(Boolean, default=False)

    patient = relationship("Patient", back_populates="clinical_history")


class WearableDaily(Base):
    __tablename__ = "wearable_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    date = Column(Date, nullable=False)
    avg_hr = Column(Float)
    resting_hr = Column(Float)
    hrv = Column(Float)
    steps = Column(Integer)
    active_minutes = Column(Integer)
    sleep_duration = Column(Float)
    sleep_efficiency = Column(Float)
    sleep_start = Column(Float)
    sleep_end = Column(Float)
    sensor_quality = Column(Float, default=1.0)

    patient = relationship("Patient", back_populates="wearable_daily")


class BPObservation(Base):
    __tablename__ = "bp_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    systolic_bp = Column(Float, nullable=False)
    diastolic_bp = Column(Float, nullable=False)
    measurement_source = Column(String(20), default="cuff")
    measurement_quality = Column(Float, default=1.0)

    patient = relationship("Patient", back_populates="bp_observations")


class TwinState(Base):
    __tablename__ = "twin_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    autonomic_state = Column(Float, nullable=False)
    recovery_state = Column(Float, nullable=False)
    circadian_state = Column(Float, nullable=False)
    cardiovascular_state = Column(Float, nullable=False)
    baseline_deviation = Column(Float, default=0.0)
    state_confidence = Column(Float, default=1.0)

    patient = relationship("Patient", back_populates="twin_states")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    prediction_time = Column(DateTime, nullable=False)
    target_date = Column(Date, nullable=False)
    risk_probability = Column(Float, nullable=False)
    predicted_sbp = Column(Float)
    predicted_dbp = Column(Float)
    lower_sbp = Column(Float)
    upper_sbp = Column(Float)
    lower_dbp = Column(Float)
    upper_dbp = Column(Float)
    risk_level = Column(String(20))
    confidence = Column(Float)
    top_driver_1 = Column(String(100))
    top_driver_2 = Column(String(100))
    top_driver_3 = Column(String(100))
    model_version = Column(String(20), default="v1.0")

    patient = relationship("Patient", back_populates="predictions")
