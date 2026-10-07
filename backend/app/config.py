from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "dawntwin.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"
MODEL_DIR = BASE_DIR / "trained_models"
MODEL_DIR.mkdir(exist_ok=True)

RANDOM_SEED = 42
N_SYNTHETIC_PATIENTS = 200
WEARABLE_DAYS = 30

MORNING_WINDOW_START = 6
MORNING_WINDOW_END = 10
SBP_THRESHOLD = 140
DBP_THRESHOLD = 90

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

TWIN_ALPHA = 0.3
