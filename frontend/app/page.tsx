"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getPatient,
  getPrediction,
  getTwin,
  getRiskHistory,
} from "@/lib/api";
import type {
  PatientDetail,
  PredictionResult,
  TwinData,
  RiskHistory,
} from "@/lib/types";

const DEFAULT_PATIENT_ID = 12;

function riskColor(level: string): string {
  switch (level) {
    case "Critical":
      return "#ef4444";
    case "High":
      return "#f97316";
    case "Moderate":
      return "#f59e0b";
    default:
      return "#22c55e";
  }
}

function stateColor(value: number): string {
  if (value >= 70) return "#22c55e";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

function stateLabel(value: number): string {
  if (value >= 70) return "Good";
  if (value >= 50) return "Moderate";
  return "Poor";
}

export default function Dashboard() {
  const router = useRouter();
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID);
  const [patientIdInput, setPatientIdInput] = useState(String(DEFAULT_PATIENT_ID));
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [twin, setTwin] = useState<TwinData | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatient = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const [patientData, predData, twinData] = await Promise.all([
        getPatient(id),
        getPrediction(id),
        getTwin(id),
      ]);
      setPatient(patientData);
      setPrediction(predData);
      setTwin(twinData);

      getRiskHistory(id, 7).then(setRiskHistory).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load patient data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatient(patientId);
  }, [patientId, loadPatient]);

  const handlePatientSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(patientIdInput, 10);
    if (id > 0 && id <= 200) {
      setPatientId(id);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-block">
          <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#64748b] font-mono text-sm">Loading patient dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <p className="text-[#ef4444] font-mono mb-4">{error}</p>
        <button
          onClick={() => loadPatient(patientId)}
          className="px-4 py-2 bg-[#1e293b] border border-[#334155] rounded text-sm font-mono hover:bg-[#334155] transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!patient || !prediction) return null;

  const pct = Math.round(prediction.risk_probability * 100);
  const color = riskColor(prediction.risk_level);
  const ts = twin?.current;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
      {/* ─── HERO: Patient Info + Risk ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Patient Info (left) */}
        <div className="lg:col-span-4 bg-[#111827] border border-[#1e293b] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b]">
              Patient
            </h2>
            <form onSubmit={handlePatientSwitch} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={200}
                value={patientIdInput}
                onChange={(e) => setPatientIdInput(e.target.value)}
                className="w-16 bg-[#0a0f1c] border border-[#334155] rounded px-2 py-1 text-xs font-mono text-center focus:border-[#3b82f6] outline-none"
              />
              <button
                type="submit"
                className="text-xs font-mono text-[#3b82f6] hover:text-white transition"
              >
                Go
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xl font-bold font-mono">Patient {patient.id}</p>
              <p className="text-sm text-[#94a3b8] font-mono">
                {patient.age}y {patient.sex === "M" ? "Male" : "Female"}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {patient.hypertension && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-mono">
                  Hypertension
                </span>
              )}
              {patient.diabetes && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] font-mono">
                  Diabetes
                </span>
              )}
              {patient.dyslipidemia && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#a855f7]/15 text-[#a855f7] font-mono">
                  Dyslipidemia
                </span>
              )}
              {patient.family_cvd && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#8b5cf6]/15 text-[#8b5cf6] font-mono">
                  Family CVD
                </span>
              )}
              {patient.smoking_status && patient.smoking_status !== "never" && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#64748b]/15 text-[#94a3b8] font-mono">
                  Smoker
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-[#94a3b8] pt-2 border-t border-[#1e293b]">
              <div>BMI: <span className="text-white">{patient.bmi}</span></div>
              <div>Height: <span className="text-white">{patient.height_cm}cm</span></div>
              <div>Weight: <span className="text-white">{patient.weight_kg}kg</span></div>
              {patient.latest_bp && (
                <div>
                  Last BP:{" "}
                  <span className="text-white">
                    {Math.round(patient.latest_bp.systolic)}/{Math.round(patient.latest_bp.diastolic)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#1e293b] space-y-1.5">
              <Link
                href={`/patient/${patient.id}`}
                className="block text-xs font-mono text-[#3b82f6] hover:text-white transition"
              >
                [Overview]
              </Link>
              <Link
                href={`/patient/${patient.id}/twin`}
                className="block text-xs font-mono text-[#3b82f6] hover:text-white transition"
              >
                [Twin State]
              </Link>
              <Link
                href={`/patient/${patient.id}/drivers`}
                className="block text-xs font-mono text-[#3b82f6] hover:text-white transition"
              >
                [Risk Drivers]
              </Link>
              <Link
                href={`/patient/${patient.id}/simulate`}
                className="block text-xs font-mono text-[#3b82f6] hover:text-white transition"
              >
                [Simulation]
              </Link>
            </div>
          </div>
        </div>

        {/* Tomorrow Morning Risk (right) */}
        <div
          className="lg:col-span-8 border rounded-lg p-6 flex flex-col items-center justify-center"
          style={{
            backgroundColor: `${color}08`,
            borderColor: `${color}30`,
          }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#64748b] mb-4">
            Tomorrow Morning
          </p>

          <div className="relative mb-3">
            <svg viewBox="0 0 120 120" className="w-36 h-36">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#1e293b"
                strokeWidth="6"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${pct * 3.27} 327`}
                transform="rotate(-90 60 60)"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold font-mono" style={{ color }}>
                {pct}%
              </span>
            </div>
          </div>

          <p
            className="text-sm font-bold font-mono uppercase tracking-widest mb-4"
            style={{ color }}
          >
            {prediction.risk_level} Risk
          </p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm font-mono">
            <div className="text-[#64748b]">Predicted BP:</div>
            <div className="text-white">
              {Math.round(prediction.lower_sbp)}&ndash;{Math.round(prediction.upper_sbp)} /{" "}
              {Math.round(prediction.lower_dbp)}&ndash;{Math.round(prediction.upper_dbp)}
            </div>
            <div className="text-[#64748b]">Risk window:</div>
            <div className="text-white">
              {prediction.risk_window.start}&ndash;{prediction.risk_window.end}
            </div>
            <div className="text-[#64748b]">Confidence:</div>
            <div className="text-white">{Math.round(prediction.confidence * 100)}%</div>
          </div>
        </div>
      </div>

      {/* ─── DIGITAL TWIN STATE ─── */}
      {ts && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
            Digital Twin State
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Autonomic", value: ts.autonomic },
              { label: "Recovery", value: ts.recovery },
              { label: "Circadian", value: ts.circadian },
              { label: "Cardiovascular", value: ts.cardiovascular },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm font-mono text-[#94a3b8]">{s.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-[#1e293b] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${s.value}%`,
                        backgroundColor: stateColor(s.value),
                      }}
                    />
                  </div>
                  <span
                    className="text-sm font-mono font-bold w-12 text-right"
                    style={{ color: stateColor(s.value) }}
                  >
                    {Math.round(s.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e293b]">
            <span className="text-xs font-mono text-[#64748b]">
              Baseline deviation:{" "}
              <span
                style={{
                  color:
                    ts.baseline_deviation > 30
                      ? "#ef4444"
                      : ts.baseline_deviation > 15
                      ? "#f59e0b"
                      : "#22c55e",
                }}
              >
                {Math.round(ts.baseline_deviation)}%
              </span>
            </span>
            <span className="text-xs font-mono text-[#64748b]">
              Confidence:{" "}
              <span className="text-[#3b82f6]">{Math.round(ts.confidence * 100)}%</span>
            </span>
            <span className="text-xs font-mono text-[#64748b]">
              Overall:{" "}
              <span style={{ color: stateColor(ts.cardiovascular) }}>
                {stateLabel(ts.cardiovascular)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ─── WHY DID RISK CHANGE? ─── */}
      {prediction.drivers.length > 0 && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
            Why Did Risk Change?
          </h2>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {prediction.drivers.slice(0, 5).map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`text-sm font-mono ${
                    d.direction === "increasing"
                      ? "text-[#ef4444]"
                      : "text-[#22c55e]"
                  }`}
                >
                  {d.direction === "increasing" ? "↑" : "↓"}
                </span>
                <span className="text-sm font-mono text-[#e2e8f0]">
                  {d.label}
                </span>
                <span className="text-xs font-mono text-[#64748b]">
                  {d.contribution_pct}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#1e293b]">
            <Link
              href={`/patient/${patient.id}/drivers`}
              className="text-xs font-mono text-[#3b82f6] hover:text-white transition"
            >
              View full driver analysis &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* ─── 7-DAY PERSONAL RISK TRAJECTORY ─── */}
      {riskHistory && riskHistory.timeline && riskHistory.timeline.length > 0 && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
            7-Day Personal Risk Trajectory
          </h2>
          <div className="flex items-end gap-2 h-32">
            {riskHistory.timeline.slice(-7).map((point, i) => {
              const maxSbp = Math.max(
                ...riskHistory.timeline.slice(-7).map((p) => p.systolic),
                140
              );
              const minSbp = Math.min(
                ...riskHistory.timeline.slice(-7).map((p) => p.systolic),
                110
              );
              const range = maxSbp - minSbp || 1;
              const height = ((point.systolic - minSbp) / range) * 100;
              const barColor = point.elevated ? "#ef4444" : "#22c55e";
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono" style={{ color: barColor }}>
                    {Math.round(point.systolic)}
                  </span>
                  <div className="w-full flex-1 relative bg-[#1e293b] rounded-t">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-500"
                      style={{
                        height: `${Math.max(height, 5)}%`,
                        backgroundColor: barColor,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[#64748b]">
                    {point.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e293b] text-[10px] font-mono text-[#64748b]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Elevated (SBP&ge;140 or DBP&ge;90)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Normal
            </span>
            {riskHistory.summary && (
              <span className="ml-auto">
                Elevated {riskHistory.summary.elevated_count}/{riskHistory.summary.total_observations} days
                ({Math.round(riskHistory.summary.elevated_pct)}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── 7-DAY TWIN TRAJECTORY (fallback when no risk history) ─── */}
      {(!riskHistory || !riskHistory.timeline || riskHistory.timeline.length === 0) &&
        twin &&
        twin.trajectory.length > 0 && (
          <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
              7-Day Cardiovascular Trajectory
            </h2>
            <div className="flex items-end gap-2 h-32">
              {twin.trajectory.map((t, i) => {
                const maxCv = Math.max(...twin.trajectory.map((p) => p.cardiovascular), 1);
                const height = (t.cardiovascular / maxCv) * 100;
                const barColor = stateColor(t.cardiovascular);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono" style={{ color: barColor }}>
                      {Math.round(t.cardiovascular)}
                    </span>
                    <div className="w-full flex-1 relative bg-[#1e293b] rounded-t">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-500"
                        style={{
                          height: `${height}%`,
                          backgroundColor: barColor,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#64748b]">
                      {t.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* ─── Medical disclaimer ─── */}
      <div className="text-center py-2">
        <p className="text-[9px] font-mono text-[#475569] leading-relaxed max-w-3xl mx-auto">
          DAWNTWIN is a research prototype. It does not diagnose, treat, or prescribe.
          All predictions are model-generated estimates based on physiological patterns
          and should not replace clinical judgment. Not a medical device. Not clinically validated.
        </p>
      </div>
    </div>
  );
}
