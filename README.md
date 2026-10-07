# DAWNTWIN

## Personalized Cardiovascular Digital Twin for Predicting Morning Hypertensive Risk

> **Don't wait for tomorrow morning's blood pressure to rise. Forecast it tonight.**

DAWNTWIN is a proof-of-concept healthcare Digital Twin that combines a patient's historical health profile with dynamic wearable-style physiological data to estimate the probability of an elevated blood-pressure event during the following morning window.

Instead of producing a one-time generic health score, DAWNTWIN maintains a patient-specific state that is updated from recent physiological data, generates a short-horizon cardiovascular risk forecast, explains the major drivers of that forecast, and supports controlled what-if simulation.

---

## Competition

**Digital Twin Challenge 2026 — Happiest Health**

**Team Name:** No Scope  
**Institution:** St. Joseph's College of Engineering  
**Program:** B.Tech Artificial Intelligence and Data Science  
**Batch:** 2025–2029

### Team

| Role | Member |
|---|---|
| Team Leader | Rokeshwaran M |
| Member | M Mohamed Aaqil |
| Member | Rukmangathan R P |
| Member | Parmesh KS |

---

# 1. Problem Statement

Hypertension is usually managed using measurements and historical records that describe what has already happened. Consumer wearables can provide continuous signals such as heart rate, activity and sleep, but these signals are rarely fused with a patient's longitudinal clinical profile into a continuously updated, patient-specific forecasting system.

The problem addressed by DAWNTWIN is:

> **Can a personalized cardiovascular Digital Twin combine historical health information with recent physiological signals to forecast whether a patient is likely to experience elevated blood pressure during the next morning window?**

The prototype focuses on a narrow and measurable outcome rather than attempting to model the entire human body.

### Target outcome

An **elevated morning blood-pressure event**, defined in the current prototype as:

- Systolic BP >= 140 mmHg, or
- Diastolic BP >= 90 mmHg

within the configured morning window:

**06:00–10:00**

The threshold and morning window are centralized in the backend configuration so they are not duplicated across application code.

---

# 2. Healthcare Use Case

DAWNTWIN is designed as a clinician-facing decision-support prototype.

A doctor can:

1. Select a patient.
2. View the patient's personal baseline.
3. Inspect the current Digital Twin state.
4. See the predicted next-morning BP risk.
5. Understand the physiological factors contributing to the forecast.
6. Inspect the patient's recent trajectory.
7. Run a controlled what-if simulation using supported physiological inputs.

The intended workflow is:

```text
Historical health profile
          +
Recent physiological data
          ↓
Personal baseline
          ↓
Evolving Digital Twin state
          ↓
Next-morning BP risk forecast
          ↓
Risk drivers
          ↓
Scenario simulation
```

---

# 3. Why DAWNTWIN?

DAWNTWIN is deliberately different from a generic health dashboard or a simple hypertension classifier.

A conventional ML pipeline often looks like:

```text
Input → Prediction
```

DAWNTWIN maintains a persistent, patient-specific state:

```text
Historical data
      +
Dynamic data
      +
Personal baseline
      ↓
Digital Twin state
      ↓
Forecast
      ↓
Explanation
      ↓
Scenario simulation
```

The focus is therefore not only on **measurement**, but on **short-horizon personalized forecasting**.

---

# 4. Digital Twin Concept

The DAWNTWIN Digital Twin is a software representation of a patient's current modeled cardiovascular state.

The prototype maintains four model-derived state dimensions:

- **Recovery State**
- **Autonomic State**
- **Circadian State**
- **Cardiovascular State**

These states are derived from the patient's historical profile, recent physiological observations and deviations from their personal baseline.

The twin is updated as newer data becomes available.

### Important scope

The DAWNTWIN twin is **not** intended to be a whole-body physiological simulator. It is a focused proof-of-concept for cardiovascular/morning-BP risk forecasting.

The displayed state variables are **model-derived states**, not direct clinical measurements.

---

# 5. Input Data

The current prototype uses **synthetically generated, privacy-safe patient data**.

The seeded dataset is configured for:

- **200 synthetic patients**
- **30 days of wearable-style time-series data**
- approximately **6,000 blood-pressure observations**
- deterministic generation using a fixed random seed

The synthetic generator encodes a measurable relationship between physiological degradation and morning BP risk, including patterns such as:

- reduced sleep
- reduced activity
- elevated resting heart rate
- personal baseline deviations
- historical BP patterns

No real patient-identifying information is used by the prototype.

---

# 6. Data Streams

DAWNTWIN is structured around two complementary streams.

## Static / Historical stream

The patient profile and historical records provide context such as:

- demographics
- body measurements
- hypertension/diabetes status
- family cardiovascular history
- historical blood pressure
- resting heart rate
- laboratory-style health variables
- medication flag

## Dynamic stream

The wearable-style time series contains signals such as:

- average heart rate
- resting heart rate
- HRV
- step count
- active minutes
- sleep duration
- sleep efficiency
- sleep timing
- sensor/data quality

The two streams are fused before the final forecast is generated.

---

# 7. Personal Baseline

A core component of DAWNTWIN is the **patient-specific baseline**.

Rather than interpreting every patient using the same population-level reference, the system calculates baseline statistics from the patient's own history.

Examples include:

- 7-day and 30-day BP baselines
- resting heart-rate baseline
- HRV baseline
- sleep baseline
- activity baseline

The current state is represented partly through deviations from these personal baselines.

Conceptually:

```text
Current physiological value
            -
Personal baseline
            =
Patient-specific deviation
```

This allows the system to represent a change that may be meaningful for one patient even when the same absolute value would be unremarkable for another.

---

# 8. ML Pipeline

The prototype contains a complete forecasting pipeline:

```text
Synthetic patient data
        ↓
Preprocessing
        ↓
Feature engineering
        ↓
Personal baseline calculation
        ↓
Digital Twin state update
        ↓
Classification / regression models
        ↓
Probability calibration
        ↓
Risk explanation
        ↓
Dashboard
```

### Feature engineering

The current system constructs features from:

### Sleep

- sleep duration
- sleep efficiency
- recent sleep trends
- sleep-related baseline deviations

### Cardiovascular

- resting heart rate
- heart-rate deviation from baseline
- HRV
- HRV deviation

### Activity

- steps
- active minutes
- activity trends
- activity deviation from baseline

### BP history

- recent BP averages
- longer-term BP averages
- morning BP patterns
- previous morning elevation frequency

The current trained feature set contains **36 features**.

---

# 9. Models

The project currently compares:

### Baseline

**Logistic Regression**

### Main model

**XGBoost**

The XGBoost model is calibrated for probabilistic risk output.

Regression models are also included for:

- predicted morning SBP
- predicted morning DBP

The repository contains trained model artifacts under:

```text
backend/trained_models/
```

including:

- classification model
- raw classification model
- SBP regression model
- DBP regression model
- feature names
- evaluation metrics

---

# 10. Digital Twin State Engine

The backend contains a dedicated Twin Engine that combines:

- personal baseline
- recent wearable/physiological features
- patient history

to maintain model-derived state variables.

The relevant implementation lives under:

```text
backend/app/services/twin_engine.py
backend/app/services/baseline.py
backend/app/services/feature_engine.py
```

The current state representation includes:

```text
Recovery State
Autonomic State
Circadian State
Cardiovascular State
Baseline Deviation
State Confidence
```

This state is then consumed by the forecasting pipeline.

---

# 11. Explainability

DAWNTWIN uses **SHAP-based explainability** for the prediction pipeline.

The system is designed to expose the major model contributors rather than only displaying a probability.

A driver can be represented as:

```text
Feature
Current value
Personal baseline
Deviation
Model contribution
Rank
```

Example:

```text
Sleep duration
Current: 5.4 h
Baseline: 7.2 h
Deviation: -1.8 h
Contribution: increased risk
```

The goal is to make the forecast understandable to a clinician rather than presenting a black-box probability alone.

---

# 12. Scenario Simulation

DAWNTWIN includes a what-if simulation service.

The simulation accepts supported physiological input changes and re-runs the forecast without mutating the patient's stored real state.

Conceptually:

```text
Current patient state
        ↓
Baseline forecast
        ↓
Apply scenario
        ↓
Recompute affected features/state
        ↓
Run model again
        ↓
Compare forecasts
```

The simulation is intended to show **model-generated trajectory differences**, not to provide treatment instructions.

The application must never use the simulation to prescribe, stop, start, or alter medication.

---

# 13. Evaluation Methodology

The current experiment uses **patient-level separation** rather than randomly mixing rows from the same patient across train and test.

Configured split:

| Split | Patients | Rows |
|---|---:|---:|
| Train | 140 | 4,060 |
| Validation | 30 | 870 |
| Test | 30 | 870 |

This design reduces patient leakage compared with randomly splitting individual time-series rows.

The final evaluation set contains:

- **870 test samples**
- **160 positive morning-BP events**

---

# 14. Current Evaluation Results

Current saved evaluation results in the repository report the following for the main XGBoost model:

| Metric | Result |
|---|---:|
| AUROC | **0.8726** |
| AUPRC | **0.6682** |
| Sensitivity | **0.5813** |
| Specificity | **0.9549** |
| Brier Score | **0.0927** |
| Expected Calibration Error | **0.0419** |

### DAWNTWIN full ablation result

The stored evaluation also reports:

| Metric | DAWNTWIN Full |
|---|---:|
| AUROC | **0.8825** |
| AUPRC | **0.6822** |
| Sensitivity | **0.6063** |
| Specificity | **0.9535** |
| Brier Score | **0.0902** |
| ECE | **0.0419** |

The repository also contains an ablation comparison for:

- EHR only
- Wearable only
- EHR + Wearable
- DAWNTWIN full

This is used to test whether multimodal fusion and personalized state representation add predictive value.

### Important interpretation

These are **prototype results on synthetic data**, not clinical validation results.

They should not be interpreted as evidence that DAWNTWIN is clinically accurate or ready for patient care.

---

# 15. Ablation Study

The current repository includes the following stored test-set comparison:

| Configuration | AUROC | AUPRC |
|---|---:|---:|
| EHR only | 0.8141 | 0.5275 |
| Wearable only | 0.5795 | 0.2173 |
| EHR + Wearable | 0.8786 | 0.6587 |
| **DAWNTWIN Full** | **0.8825** | **0.6822** |

This experiment is important because the central hypothesis is not simply that wearables can predict BP.

The intended hypothesis is that:

> **Longitudinal patient context + dynamic physiological data + patient-specific state modeling can provide a stronger personalized forecast than a single input stream.**

---

# 16. Technology Stack

## Backend

- Python 3.11+
- FastAPI
- Uvicorn
- SQLAlchemy
- Pydantic

## Machine Learning

- Pandas
- NumPy
- scikit-learn
- XGBoost
- SHAP

## Database

- SQLite for the current proof-of-concept

## Frontend

- Next.js 16
- React 19
- Tailwind CSS v4

## Testing / Development

- pytest
- HTTPX

---

# 17. Repository Structure

```text
DAWNTWIN/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── data/
│   │   ├── models/
│   │   ├── services/
│   │   ├── config.py
│   │   └── main.py
│   │
│   ├── trained_models/
│   ├── tests/
│   ├── dawntwin.db
│   └── pyproject.toml
│
├── frontend/
│
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

The frontend is maintained as a repository submodule in the current project.

---

# 18. API

The backend exposes the following logical API capabilities:

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Backend health |
| `GET /api/patients` | Patient list |
| `GET /api/patients/{id}` | Patient details and twin information |
| `GET /api/patients/{id}/twin` | Twin trajectory |
| `POST /api/patients/{id}/predict` | Forecast and explanation |
| `POST /api/patients/{id}/simulate` | What-if simulation |
| `POST /data/seed` | Generate synthetic data |
| `POST /model/train` | Train the forecasting models |

The exact request and response schemas are defined in the backend application.

---

# 19. Quick Start

## Backend

Requirements:

- Python 3.11+
- pip

```bash
cd backend
pip install -e .
```

Seed the synthetic database:

```bash
python -c "from app.data.seed import seed_database; seed_database()"
```

Update the Digital Twin states and train the models:

```bash
python -c "
from app.models.database import SessionLocal
from app.services.twin_engine import update_all_twins
from app.services.forecast import train_models

db = SessionLocal()
update_all_twins(db)
train_models(db)
db.close()
"
```

Start the API:

```bash
uvicorn app.main:app --port 8000
```

Health check:

```text
http://localhost:8000/api/health
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev -- --port 3001
```

The frontend is configured to communicate with the local FastAPI backend.

---

# 20. Demo Flow

The intended demonstration follows one patient rather than treating the system as a generic patient database.

```text
Select Patient
      ↓
Patient Overview
      ↓
Tomorrow Morning BP Risk
      ↓
Personal Baseline
      ↓
Digital Twin State
      ↓
Risk Drivers
      ↓
7-Day Trajectory
      ↓
What-If Simulation
      ↓
Compare Current vs Simulated Risk
```

The main product question is:

> **What is this patient's physiological trajectory likely to look like tomorrow morning, and what factors are driving that forecast?**

---

# 21. Safety and Clinical Scope

DAWNTWIN is a **proof-of-concept predictive decision-support system**.

It is not:

- a medical diagnosis system
- a certified medical device
- a clinical treatment system
- an emergency detection service
- a medication-prescription system

The system does not recommend starting, stopping, or changing medications.

Scenario simulation represents **model-generated projections** and should not be interpreted as clinical treatment recommendations.

Because the current evaluation uses synthetic data, the reported results do not establish clinical effectiveness or real-world patient safety.

---

# 22. Limitations

The current prototype has several important limitations:

1. The training/evaluation data are synthetic.
2. Wearable signals are simulated rather than directly connected to consumer devices.
3. The prototype is not clinically validated.
4. The Digital Twin is a focused cardiovascular state representation, not a whole-body physiological model.
5. External validation on independent real-world cohorts is still required.
6. Calibration and performance may change substantially when applied to real-world heterogeneous populations.
7. Clinical workflow integration, privacy controls, regulatory validation and prospective evaluation are outside the current proof-of-concept scope.

These limitations are explicit by design; the project is intended as a technical Digital Twin proof-of-concept rather than a clinical deployment claim.

---

# 23. Future Work

The next stages of DAWNTWIN can include:

- validation on real de-identified longitudinal datasets
- integration with open wearable datasets
- device/API ingestion for supported wearable streams
- improved uncertainty estimation
- external validation across different populations
- prospective evaluation
- richer temporal state estimation
- clinician workflow integration
- stronger governance, security and privacy controls
- regulatory pathway assessment for any future clinical product

---

# 24. Competition Deliverables

The repository is intended to contain all material required for the Digital Twin Challenge 2026 submission.

## Required repository material

- [x] Team details
- [x] College / institution information
- [x] Project title
- [x] Problem statement
- [x] Healthcare use case
- [x] Technical stack
- [x] AI/ML methodology
- [x] Evaluation methodology and results
- [ ] 15–20 minute demonstration video
- [ ] Open-source license file
- [ ] Architecture diagram PDF/PPT
- [ ] Presentation PDF/PPT
- [ ] Final public-access verification

Replace the placeholder items above with the final links/files before submission.

---

# 25. Demo Video

**Status:** To be added

Recommended link format:

```text
[Watch the 15–20 minute demo](YOUR_YOUTUBE_LINK)
```

The final demo should cover:

1. Problem
2. Digital Twin concept
3. Architecture
4. Data pipeline
5. ML pipeline
6. Live patient walkthrough
7. Prediction
8. Explainability
9. Simulation
10. Evaluation results
11. Limitations and future work

---

# 26. Architecture Diagram

**Status:** To be added

Recommended file:

```text
docs/architecture.pdf
```

---

# 27. Presentation

**Status:** To be added

Recommended file:

```text
docs/presentation.pdf
```

---

# 28. Open-Source License

DAWNTWIN is intended to be released under the **MIT License**.

Add the official `LICENSE` file to the repository before final submission.

---

# 29. Repository

GitHub:

https://github.com/Rokesh2008/DAWNTWIN

---

## Team No Scope

**Rokeshwaran M**  
**M Mohamed Aaqil**  
**Rukmangathan R P**  
**Parmesh KS**

**St. Joseph's College of Engineering**  
**B.Tech Artificial Intelligence and Data Science**  
**2025–2029**

---

> **DAWNTWIN moves the question from “What is the patient's blood pressure?” to “Where is this patient's physiology heading tomorrow morning?”**
