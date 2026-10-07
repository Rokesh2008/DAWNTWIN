"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSimulation } from "@/lib/api";
import type { Scenario } from "@/lib/types";

function riskBarColor(risk: number): string {
  if (risk >= 0.7) return "#ef4444";
  if (risk >= 0.5) return "#f97316";
  if (risk >= 0.3) return "#f59e0b";
  return "#22c55e";
}

export default function SimulatePage() {
  const params = useParams();
  const id = Number(params.id);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getSimulation(id)
      .then((data) => setScenarios(data.scenarios))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to run simulation")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-[#64748b] animate-pulse text-lg py-20 text-center">
        Running simulations...
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

  const currentRisk = scenarios[0]?.risk_probability ?? 0;

  return (
    <div className="space-y-6">
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">What-If Simulation</h2>
        <p className="text-sm text-[#64748b] mb-6">
          How does the patient&apos;s projected morning BP risk change under safe,
          non-pharmacological recovery scenarios?
        </p>

        <div className="space-y-5">
          {scenarios.map((s, i) => {
            const pct = Math.round(s.risk_probability * 100);
            const color = riskBarColor(s.risk_probability);
            const isCurrent = i === 0;
            const deltaPct = Math.round(s.delta_risk * 100);

            return (
              <div
                key={i}
                className={`rounded-lg p-4 ${
                  isCurrent
                    ? "bg-[#1e293b]/50 border border-[#334155]"
                    : "bg-[#0f172a] border border-[#1e293b]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {s.scenario_name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#64748b]/20 text-[#94a3b8]">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!isCurrent && deltaPct !== 0 && (
                      <span
                        className={`text-sm font-semibold ${
                          deltaPct < 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                        }`}
                      >
                        {deltaPct > 0 ? "+" : ""}
                        {deltaPct}pp
                      </span>
                    )}
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="h-5 bg-[#1e293b] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      opacity: isCurrent ? 1 : 0.8,
                    }}
                  />
                </div>

                {!isCurrent && s.predicted_sbp !== null && s.delta_sbp !== null && (
                  <div className="mt-2 text-xs text-[#64748b]">
                    Projected SBP: {Math.round(s.predicted_sbp)} mmHg (
                    {s.delta_sbp > 0 ? "+" : ""}
                    {Math.round(s.delta_sbp)} mmHg)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Delta summary */}
        {scenarios.length > 1 && (
          <div className="mt-6 p-4 bg-[#0f172a] border border-[#1e293b] rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#22c55e] text-lg">&#x2193;</span>
              <span className="text-sm font-semibold">Best scenario</span>
            </div>
            {(() => {
              const best = scenarios.reduce((a, b) =>
                b.risk_probability < a.risk_probability ? b : a
              );
              const delta = Math.round(
                (currentRisk - best.risk_probability) * 100
              );
              return (
                <p className="text-sm text-[#94a3b8]">
                  &ldquo;{best.scenario_name}&rdquo; could reduce morning BP
                  risk by{" "}
                  <span className="text-[#22c55e] font-semibold">
                    {delta} percentage points
                  </span>{" "}
                  — from {Math.round(currentRisk * 100)}% to{" "}
                  {Math.round(best.risk_probability * 100)}%.
                </p>
              );
            })()}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-[#1e293b]/30 border border-[#334155] rounded-lg p-5 text-center">
        <p className="text-[10px] font-mono text-[#475569] leading-relaxed">
          Simulation represents model-generated projections based on observed
          physiological patterns. It does not diagnose, prescribe medication,
          recommend dosage changes, or substitute for clinical judgment.
          Scenarios modify measured inputs within the predictive model and do
          not guarantee real-world outcomes. Not a medical device. Not clinically validated.
        </p>
      </div>
    </div>
  );
}
