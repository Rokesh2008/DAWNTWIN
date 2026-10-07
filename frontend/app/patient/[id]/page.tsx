"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPrediction, getPatient, getPatientBaseline, getRiskHistory } from "@/lib/api";
import type { PredictionResult, PatientDetail, PatientBaseline, RiskHistory } from "@/lib/types";

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

function riskBgClass(level: string): string {
  switch (level) {
    case "Critical":
      return "bg-[#ef4444]/10 border-[#ef4444]/30";
    case "High":
      return "bg-[#f97316]/10 border-[#f97316]/30";
    case "Moderate":
      return "bg-[#f59e0b]/10 border-[#f59e0b]/30";
    default:
      return "bg-[#22c55e]/10 border-[#22c55e]/30";
  }
}

function qualityColor(q: string): string {
  if (q === "Good") return "#22c55e";
  if (q === "Fair") return "#f59e0b";
  return "#ef4444";
}

function zColor(z: number): string {
  const abs = Math.abs(z);
  if (abs < 1) return "#22c55e";
  if (abs < 2) return "#f59e0b";
  return "#ef4444";
}

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  resting_hr: { label: "Resting HR", unit: "bpm" },
  hrv: { label: "HRV", unit: "ms" },
  sleep_duration: { label: "Sleep", unit: "hrs" },
  steps: { label: "Steps", unit: "" },
  active_minutes: { label: "Activity", unit: "min" },
};

export default function PatientOverview() {
  const params = useParams();
  const id = Number(params.id);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [baseline, setBaseline] = useState<PatientBaseline | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getPrediction(id),
      getPatient(id),
      getPatientBaseline(id).catch(() => null),
      getRiskHistory(id, 7).catch(() => null),
    ])
      .then(([pred, pat, bl, rh]) => {
        setPrediction(pred);
        setPatient(pat);
        setBaseline(bl);
        setRiskHistory(rh);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load prediction")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-[#64748b] animate-pulse text-lg py-20 text-center">
        Running forecast...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[#ef4444] py-10 text-center">
        {error}
        <button
          onClick={() => window.location.reload()}
          className="underline ml-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!prediction) return null;

  const p = prediction;
  const color = riskColor(p.risk_level);
  const pct = Math.round(p.risk_probability * 100);

  return (
    <div className="space-y-6">
      {/* Data quality + wearable days badge row */}
      {patient && (
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-mono px-2.5 py-1 rounded"
            style={{
              backgroundColor: `${qualityColor(patient.data_quality)}15`,
              color: qualityColor(patient.data_quality),
            }}
          >
            Data Quality: {patient.data_quality}
          </span>
          <span className="text-xs font-mono text-[#64748b]">
            {patient.wearable_days} days of wearable data
          </span>
        </div>
      )}

      {/* Hero risk card */}
      <div
        className={`border rounded-xl p-8 text-center ${riskBgClass(p.risk_level)}`}
      >
        <p className="text-sm uppercase tracking-widest text-[#64748b] mb-4">
          Tomorrow Morning BP Risk
        </p>

        <div className="relative inline-block mb-4">
          <svg viewBox="0 0 120 120" className="w-44 h-44">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#1e293b"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${pct * 3.27} 327`}
              transform="rotate(-90 60 60)"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold" style={{ color }}>
              {pct}%
            </span>
            <span
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color }}
            >
              {p.risk_level}
            </span>
          </div>
        </div>

        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div>
            <span className="text-[#64748b]">SBP </span>
            <span className="font-semibold">
              {Math.round(p.lower_sbp)}&ndash;{Math.round(p.upper_sbp)} mmHg
            </span>
          </div>
          <div>
            <span className="text-[#64748b]">DBP </span>
            <span className="font-semibold">
              {Math.round(p.lower_dbp)}&ndash;{Math.round(p.upper_dbp)} mmHg
            </span>
          </div>
        </div>

        <div className="flex justify-center gap-8 mt-3 text-sm text-[#94a3b8]">
          <span>
            Risk window: {p.risk_window.start} &ndash; {p.risk_window.end}
          </span>
          <span>
            Confidence: {Math.round(p.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Drivers */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">
          Why is risk {p.risk_level.toLowerCase()}?
        </h2>
        <div className="space-y-3">
          {p.drivers.map((d, i) => (
            <div key={i} className="flex items-center gap-4">
              <span
                className={`text-lg w-6 text-center ${
                  d.direction === "increasing"
                    ? "text-[#ef4444]"
                    : "text-[#22c55e]"
                }`}
              >
                {d.direction === "increasing" ? "↑" : "↓"}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className="text-xs text-[#64748b]">
                    {d.contribution_pct}%
                  </span>
                </div>
                <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      d.direction === "increasing"
                        ? "bg-[#ef4444]"
                        : "bg-[#22c55e]"
                    }`}
                    style={{ width: `${Math.min(d.contribution_pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predicted values */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">
            Predicted SBP
          </p>
          <p className="text-2xl font-bold">
            {Math.round(p.predicted_sbp)}{" "}
            <span className="text-sm font-normal text-[#64748b]">mmHg</span>
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">
            Predicted DBP
          </p>
          <p className="text-2xl font-bold">
            {Math.round(p.predicted_dbp)}{" "}
            <span className="text-sm font-normal text-[#64748b]">mmHg</span>
          </p>
        </div>
      </div>

      {/* Baseline Comparison */}
      {baseline && baseline.deviations && Object.keys(baseline.deviations).length > 0 && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Personal Baseline Comparison</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(baseline.deviations).map(([key, dev]) => {
              const meta = METRIC_LABELS[key];
              if (!meta) return null;
              return (
                <div key={key} className="bg-[#0a0f1c] border border-[#1e293b] rounded-lg p-3">
                  <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">
                    {meta.label}
                  </p>
                  <p className="text-lg font-bold font-mono text-white">
                    {dev.current.toFixed(1)}
                    {meta.unit && (
                      <span className="text-[10px] text-[#64748b] ml-1">{meta.unit}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-[#64748b]">
                      vs {dev.baseline.toFixed(1)}
                    </span>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: zColor(dev.z_score) }}
                    >
                      ({dev.z_score > 0 ? "+" : ""}{dev.z_score.toFixed(1)}σ)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7-Day Risk History */}
      {riskHistory && riskHistory.timeline.length > 0 && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">7-Day BP History</h2>
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
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Elevated
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Normal
            </span>
            {riskHistory.summary && (
              <span className="ml-auto">
                Avg: {riskHistory.summary.avg_systolic?.toFixed(0)}/{riskHistory.summary.avg_diastolic?.toFixed(0)} mmHg
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
