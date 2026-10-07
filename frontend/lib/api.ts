import type {
  PatientSummary,
  PatientDetail,
  PatientSearchResponse,
  PatientBaseline,
  RiskHistory,
  PredictionResult,
  Scenario,
  TwinData,
  WearableDay,
  BPObservation,
  ModelMetrics,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getPatients(): Promise<PatientSummary[]> {
  return fetchAPI("/patients");
}

export async function searchPatients(params: {
  q?: string;
  sex?: string;
  min_age?: number;
  max_age?: number;
  hypertension?: boolean;
  diabetes?: boolean;
  sort_by?: string;
  limit?: number;
  offset?: number;
}): Promise<PatientSearchResponse> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return fetchAPI(`/patients/search?${searchParams.toString()}`);
}

export async function getPatient(id: number): Promise<PatientDetail> {
  return fetchAPI(`/patients/${id}`);
}

export async function getPatientBaseline(id: number): Promise<PatientBaseline> {
  return fetchAPI(`/patients/${id}/baseline`);
}

export async function getRiskHistory(id: number, days?: number): Promise<RiskHistory> {
  const params = days ? `?days=${days}` : "";
  return fetchAPI(`/patients/${id}/risk-history${params}`);
}

export async function getTwin(id: number): Promise<TwinData> {
  return fetchAPI(`/patients/${id}/twin`);
}

export async function getPrediction(id: number): Promise<PredictionResult> {
  return fetchAPI(`/patients/${id}/predict`, { method: "POST" });
}

export async function getSimulation(
  id: number
): Promise<{ scenarios: Scenario[] }> {
  return fetchAPI(`/patients/${id}/simulate`, { method: "POST" });
}

export async function getHistory(
  id: number
): Promise<{
  clinical: unknown[];
  wearable: WearableDay[];
  bp_observations: BPObservation[];
}> {
  return fetchAPI(`/patients/${id}/history`);
}

export async function seedData(): Promise<{ status: string }> {
  return fetchAPI("/data/seed", { method: "POST" });
}

export async function trainModel(): Promise<{ status: string; metrics: unknown }> {
  return fetchAPI("/model/train", { method: "POST" });
}

export async function getMetrics(): Promise<ModelMetrics> {
  return fetchAPI("/model/metrics");
}
