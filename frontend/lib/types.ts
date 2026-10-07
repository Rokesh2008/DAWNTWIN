export interface PatientSummary {
  id: number;
  age: number;
  sex: string;
  bmi: number;
  hypertension: boolean;
  diabetes: boolean;
  family_cvd: boolean;
  smoking_status?: string;
  cardiovascular_state: number | null;
}

export interface PatientSearchResult {
  id: number;
  age: number;
  sex: string;
  bmi: number;
  hypertension: boolean;
  diabetes: boolean;
  family_cvd: boolean;
  smoking_status: string;
  dyslipidemia: boolean;
  cardiovascular_state: number | null;
  baseline_deviation: number | null;
  latest_sbp: number | null;
  latest_dbp: number | null;
}

export interface PatientSearchResponse {
  patients: PatientSearchResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface TwinState {
  autonomic: number;
  recovery: number;
  circadian: number;
  cardiovascular: number;
  baseline_deviation: number;
  confidence: number;
}

export interface PatientDetail {
  id: number;
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  bmi: number;
  smoking_status: string;
  diabetes: boolean;
  hypertension: boolean;
  dyslipidemia: boolean;
  family_cvd: boolean;
  data_quality: "Good" | "Fair" | "Low";
  wearable_days: number;
  twin_state: TwinState | null;
  latest_bp: { systolic: number; diastolic: number; timestamp: string } | null;
}

export interface Driver {
  feature: string;
  label: string;
  shap_value: number;
  direction: "increasing" | "decreasing";
  contribution_pct: number;
}

export interface PredictionResult {
  risk_probability: number;
  predicted_sbp: number;
  predicted_dbp: number;
  lower_sbp: number;
  upper_sbp: number;
  lower_dbp: number;
  upper_dbp: number;
  risk_level: string;
  confidence: number;
  risk_window: { start: string; end: string };
  drivers: Driver[];
}

export interface Scenario {
  scenario_name: string;
  risk_probability: number;
  predicted_sbp: number | null;
  delta_risk: number;
  delta_sbp: number | null;
}

export interface TwinTrajectoryPoint {
  date: string;
  autonomic: number;
  recovery: number;
  circadian: number;
  cardiovascular: number;
  baseline_deviation: number;
  confidence: number;
}

export interface TwinData {
  current: TwinState;
  trajectory: TwinTrajectoryPoint[];
}

export interface WearableDay {
  date: string;
  avg_hr: number;
  resting_hr: number;
  hrv: number;
  steps: number;
  active_minutes: number;
  sleep_duration: number;
  sleep_efficiency: number;
  sensor_quality: number;
}

export interface BPObservation {
  timestamp: string;
  systolic: number;
  diastolic: number;
  source: string;
}

export interface BaselineDeviation {
  current: number;
  baseline: number;
  std: number;
  z_score: number;
  direction: "above" | "below" | "normal";
}

export interface PatientBaseline {
  baselines: Record<string, number>;
  current: {
    resting_hr: number | null;
    hrv: number | null;
    sleep_duration: number | null;
    steps: number | null;
    active_minutes: number | null;
    sleep_efficiency: number | null;
    date: string;
  } | null;
  deviations: Record<string, BaselineDeviation> | null;
}

export interface RiskTimelinePoint {
  date: string;
  systolic: number;
  diastolic: number;
  elevated: boolean;
  cardiovascular_state: number | null;
  baseline_deviation: number | null;
}

export interface RiskHistory {
  timeline: RiskTimelinePoint[];
  summary: {
    total_observations: number;
    elevated_count: number;
    elevated_pct: number;
    avg_systolic: number | null;
    avg_diastolic: number | null;
    max_systolic: number | null;
    min_systolic: number | null;
  };
}

export interface ModelMetrics {
  best_model: string;
  best_metrics: {
    auroc: number;
    auprc: number;
    sensitivity: number;
    specificity: number;
    brier_score: number;
    ece: number;
    n_samples: number;
    n_positive: number;
  };
  lr_metrics: Record<string, number>;
  xgb_metrics: Record<string, number>;
  split_info: {
    train_patients: number;
    val_patients: number;
    test_patients: number;
    train_rows: number;
    val_rows: number;
    test_rows: number;
  };
  feature_count: number;
  ablation: Array<{
    name: string;
    auroc: number;
    auprc: number;
    sensitivity: number;
    specificity: number;
    brier_score: number;
    ece: number;
    n_samples: number;
    n_positive: number;
  }>;
}
