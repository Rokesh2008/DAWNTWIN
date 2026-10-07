"use client";

import { useEffect, useState } from "react";
import { getMetrics } from "@/lib/api";
import type { ModelMetrics } from "@/lib/types";

function MetricCard({
  label,
  value,
  format = "pct",
  good,
}: {
  label: string;
  value: number;
  format?: "pct" | "dec" | "int";
  good?: "high" | "low";
}) {
  let display: string;
  if (format === "pct") display = `${(value * 100).toFixed(1)}%`;
  else if (format === "dec") display = value.toFixed(3);
  else display = String(value);

  let color = "#e2e8f0";
  if (good === "high" && value >= 0.8) color = "#22c55e";
  else if (good === "high" && value >= 0.6) color = "#f59e0b";
  else if (good === "high" && value < 0.6) color = "#ef4444";
  else if (good === "low" && value <= 0.1) color = "#22c55e";
  else if (good === "low" && value <= 0.2) color = "#f59e0b";
  else if (good === "low") color = "#ef4444";

  return (
    <div className="bg-[#0a0f1c] border border-[#1e293b] rounded-lg p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-[#64748b] mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold font-mono" style={{ color }}>
        {display}
      </p>
    </div>
  );
}

export default function ModelPage() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load metrics")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#64748b] font-mono text-sm">Loading model metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-[#ef4444] font-mono mb-2">{error}</p>
        <p className="text-sm text-[#64748b] font-mono">
          Train the model first via the Patients page.
        </p>
      </div>
    );
  }

  if (!metrics) return null;

  const m = metrics.best_metrics;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-mono">Model Evaluation</h1>
        <p className="text-sm text-[#64748b] font-mono mt-1">
          Best model: <span className="text-[#3b82f6] uppercase">{metrics.best_model}</span>
          {" "}&mdash;{" "}
          {metrics.feature_count} features, {m.n_samples} test samples ({m.n_positive} positive)
        </p>
      </div>

      {/* Primary Metrics */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
          Primary Metrics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard label="AUROC" value={m.auroc} good="high" />
          <MetricCard label="AUPRC" value={m.auprc} good="high" />
          <MetricCard label="Brier Score" value={m.brier_score} format="dec" good="low" />
          <MetricCard label="ECE" value={m.ece} format="dec" good="low" />
          <MetricCard label="Sensitivity" value={m.sensitivity} good="high" />
          <MetricCard label="Specificity" value={m.specificity} good="high" />
        </div>
      </div>

      {/* Data Split */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
        <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
          Patient-Level Data Split
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Train",
              patients: metrics.split_info.train_patients,
              rows: metrics.split_info.train_rows,
              color: "#3b82f6",
            },
            {
              label: "Validation",
              patients: metrics.split_info.val_patients,
              rows: metrics.split_info.val_rows,
              color: "#f59e0b",
            },
            {
              label: "Test",
              patients: metrics.split_info.test_patients,
              rows: metrics.split_info.test_rows,
              color: "#22c55e",
            },
          ].map((s) => (
            <div key={s.label} className="bg-[#0a0f1c] border border-[#1e293b] rounded-lg p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#64748b] mb-1">
                {s.label}
              </p>
              <p className="text-xl font-bold font-mono" style={{ color: s.color }}>
                {s.patients} patients
              </p>
              <p className="text-xs font-mono text-[#64748b]">{s.rows} samples</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-mono text-[#475569] mt-3">
          Patient-level split ensures no data leakage &mdash; all days from a patient appear in exactly one set.
        </p>
      </div>

      {/* Ablation Study */}
      {metrics.ablation && metrics.ablation.length > 0 && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-[#64748b] mb-4">
            Ablation Study
          </h2>
          <p className="text-xs font-mono text-[#64748b] mb-4">
            Does each feature group add value? Trained XGBoost on each subset independently.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-[#1e293b] text-[#64748b] text-xs uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Feature Set</th>
                  <th className="text-right px-3 py-2">AUROC</th>
                  <th className="text-right px-3 py-2">AUPRC</th>
                  <th className="text-right px-3 py-2">Sensitivity</th>
                  <th className="text-right px-3 py-2">Specificity</th>
                  <th className="text-right px-3 py-2">Brier</th>
                </tr>
              </thead>
              <tbody>
                {metrics.ablation.map((a, i) => {
                  const isBest = a.name.includes("full") || a.name.includes("DAWNTWIN");
                  return (
                    <tr
                      key={i}
                      className={`border-b border-[#1e293b]/50 ${
                        isBest ? "bg-[#3b82f6]/5" : ""
                      }`}
                    >
                      <td className={`px-3 py-2 ${isBest ? "text-[#3b82f6] font-semibold" : ""}`}>
                        {a.name}
                      </td>
                      <td className="text-right px-3 py-2">{(a.auroc * 100).toFixed(1)}%</td>
                      <td className="text-right px-3 py-2">{(a.auprc * 100).toFixed(1)}%</td>
                      <td className="text-right px-3 py-2">{(a.sensitivity * 100).toFixed(1)}%</td>
                      <td className="text-right px-3 py-2">{(a.specificity * 100).toFixed(1)}%</td>
                      <td className="text-right px-3 py-2">{a.brier_score.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Visual AUROC comparison */}
          <div className="mt-4 space-y-2">
            {metrics.ablation.map((a, i) => {
              const isBest = a.name.includes("full") || a.name.includes("DAWNTWIN");
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#94a3b8] w-36 truncate">
                    {a.name}
                  </span>
                  <div className="flex-1 h-4 bg-[#1e293b] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${a.auroc * 100}%`,
                        backgroundColor: isBest ? "#3b82f6" : "#64748b",
                        opacity: isBest ? 1 : 0.6,
                      }}
                    />
                  </div>
                  <span
                    className={`text-xs font-mono w-14 text-right ${
                      isBest ? "text-[#3b82f6] font-bold" : "text-[#94a3b8]"
                    }`}
                  >
                    {(a.auroc * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-center py-2">
        <p className="text-[9px] font-mono text-[#475569] leading-relaxed max-w-3xl mx-auto">
          Model evaluation on held-out test set with patient-level split. Metrics reflect
          performance on synthetic data and may not generalize to clinical populations.
          Calibration via isotonic regression (CalibratedClassifierCV, cv=3).
        </p>
      </div>
    </div>
  );
}
