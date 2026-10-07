# DAWNTWIN

Personalized Cardiovascular Digital Twin for Predicting Morning Hypertensive Risk.

## Quick Start

```bash
# Backend
cd backend
pip install -e .
python -c "from app.data.seed import seed_database; seed_database()"
python -c "
from app.models.database import SessionLocal
from app.services.twin_engine import update_all_twins
from app.services.forecast import train_models
db = SessionLocal()
update_all_twins(db)
train_models(db)
db.close()
"
uvicorn app.main:app --port 8000

# Frontend
cd frontend
npm install
npm run dev -- --port 3001
```

## Architecture

- **Backend**: Python/FastAPI at port 8000, SQLite database
- **Frontend**: Next.js 16 / React 19 / Tailwind v4 at port 3001
- **ML**: scikit-learn + XGBoost, SHAP explainability

## Key API Endpoints

- `GET /api/patients` — patient list
- `GET /api/patients/{id}` — patient detail + twin state
- `GET /api/patients/{id}/twin` — 7-day twin trajectory
- `POST /api/patients/{id}/predict` — forecast + SHAP drivers
- `POST /api/patients/{id}/simulate` — what-if scenarios
- `POST /data/seed` — generate synthetic data
- `POST /model/train` — train models

## Data

Synthetic data: 200 patients, 30 days wearable, ~6000 BP observations.
Real signal encoded: wearable degradation (poor sleep, low activity, elevated HR) precedes elevated morning BP.

## Model

XGBoost classifier (calibrated), patient-level train/test split.
Current AUROC: ~0.87, Brier: ~0.09, ECE: ~0.04.
