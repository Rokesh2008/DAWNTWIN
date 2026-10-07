"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTwin, getPatientBaseline } from "@/lib/api";
import type { TwinData, PatientBaseline } from "@/lib/types";

function stateColor(value: number): string {
  if (value >= 70) return "#22c55e";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

function zColor(z: number): string {
  const abs = Math.abs(z);
  if (abs < 1) return "#22c55e";
  if (abs < 2) return "#f59e0b";
  return "#ef4444";
}

function StateMeter({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  const color = stateColor(value);
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-lg font-bold" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="h-3 bg-[#1e293b] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-[#64748b]">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  resting_hr: { label: "Resting HR", unit: "bpm" },
  hrv: { label: "HRV", unit: "ms" },
  sleep_duration: { label: "Sleep Duration", unit: "hrs" },
  steps: { label: "Steps", unit: "" },
  active_minutes: { label: "Active Minutes", unit: "min" },
};

export default function TwinStatePage() {
  const params = useParams();
  const id = Number(params.id);
  const [twin, setTwin] = useState<TwinData | null>(null);
  const [baseline, setBaseline] = useState<PatientBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getTwin(id),
      getPatientBaseline(id).catch(() => null),
    ])
      .then(([twinData, baselineData]) => {
        setTwin(twinData);
        setBaseline(baselineData);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load twin state")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-[#64748b] animate-pulse text-lg py-20 text-center">
        Loading twin state...
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

  if (!twin) return null;

  const c = twin.current;
  const maxCv = Math.max(...twin.trajectory.map((t) => t.cardiovascular));

  return (
    <div className="space-y-6">
      {/* State meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StateMeter label="Autonomic State" value={c.autonomic} icon="&#x26A1;" />
        <StateMeter label="Recovery State" value={c.recovery} icon="&#x1F4A4;" />
        <StateMeter label="Circadian Stability" value={c.circadian} icon="&#x23F0;" />
        <StateMeter
          label="Cardiovascular State"
          value={c.cardiovascular}
          icon="&#x2764;"
        />
      </div>

      {/* Meta indicators */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">
            Baseline Deviation
          </p>
          <p
            className="text-2xl font-bold"
            style={{
              color: c.baseline_deviation > 30 ? "#ef4444" : c.baseline_deviation > 15 ? "#f59e0b" : "#22c55e",
            }}
          >
            {Math.round(c.baseline_deviation)}%
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Distance from healthy reference
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">
            State Confidence
          </p>
          <p className="text-2xl font-bold text-[#3b82f6]">
            {Math.round(c.confidence * 100)}%
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Based on sensor data quality
          </p>
        </div>
      </div>

      {/* Baseline vs Current Comparison */}
      {baseline && baseline.deviations && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Baseline vs Current</h2>
          <p className="text-sm text-[#64748b] mb-4">
            Personal 30-day rolling baselines compared to latest wearable readings
            {baseline.current?.date && (
              <span className="text-[#94a3b8]"> ({baseline.current.date})</span>
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b] text-xs uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Metric</th>
                  <th className="text-right px-3 py-2">Current</th>
                  <th className="text-right px-3 py-2">Baseline</th>
                  <th className="text-right px-3 py-2">Z-Score</th>
                  <th className="text-center px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(baseline.deviations).map(([key, dev]) => {
                  const meta = METRIC_LABELS[key];
                  if (!meta) return null;
                  return (
                    <tr key={key} className="border-b border-[#1e293b]/50">
                      <td className="px-3 py-2.5 text-[#e2e8f0]">{meta.label}</td>
                      <td className="px-3 py-2.5 text-right text-white">
                        {dev.current.toFixed(1)}
                        {meta.unit && (
                          <span className="text-[#64748b] text-xs ml-1">{meta.unit}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#94a3b8]">
                        {dev.baseline.toFixed(1)}
                        {meta.unit && (
                          <span className="text-[#64748b] text-xs ml-1">{meta.unit}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span style={{ color: zColor(dev.z_score) }}>
                          {dev.z_score > 0 ? "+" : ""}{dev.z_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${zColor(dev.z_score)}15`,
                            color: zColor(dev.z_score),
                          }}
                        >
                          {Math.abs(dev.z_score) < 1
                            ? "Normal"
                            : Math.abs(dev.z_score) < 2
                            ? "Elevated"
                            : "Abnormal"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] font-mono text-[#475569] mt-3">
            Z-score measures how many standard deviations the current value is from the personal 30-day baseline.
            |Z| &lt; 1 = normal variation, 1-2 = elevated, &gt; 2 = abnormal.
          </p>
        </div>
      )}

      {/* 7-day trajectory */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">7-Day Cardiovascular Trajectory</h2>
        <div className="flex items-end gap-2 h-40">
          {twin.trajectory.map((t, i) => {
            const height = maxCv > 0 ? (t.cardiovascular / maxCv) * 100 : 0;
            const color = stateColor(t.cardiovascular);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-mono" style={{ color }}>
                  {Math.round(t.cardiovascular)}
                </span>
                <div className="w-full bg-[#1e293b] rounded-t-md flex-1 relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${height}%`,
                      backgroundColor: color,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <span className="text-[10px] text-[#64748b]">
                  {t.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Multi-state trajectory */}
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-medium text-[#94a3b8] mb-2">All States</h3>
          {(["autonomic", "recovery", "circadian", "cardiovascular"] as const).map(
            (key) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-[#64748b] w-28 capitalize">
                  {key}
                </span>
                <div className="flex-1 flex gap-1">
                  {twin.trajectory.map((t, i) => {
                    const val = t[key];
                    return (
                      <div
                        key={i}
                        className="flex-1 h-5 rounded-sm flex items-center justify-center"
                        style={{
                          backgroundColor: stateColor(val),
                          opacity: 0.2 + (val / 100) * 0.8,
                        }}
                      >
                        <span className="text-[9px] font-mono text-white/80">
                          {Math.round(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
