"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPrediction, getPatientBaseline } from "@/lib/api";
import type { Driver, PatientBaseline } from "@/lib/types";

const FEATURE_TO_BASELINE: Record<string, string> = {
  resting_hr: "resting_hr",
  resting_hr_change_1d: "resting_hr",
  resting_hr_change_7d: "resting_hr",
  resting_hr_dev: "resting_hr",
  hrv: "hrv",
  hrv_change_7d: "hrv",
  hrv_dev: "hrv",
  sleep_duration: "sleep_duration",
  sleep_debt_3d: "sleep_duration",
  sleep_debt_7d: "sleep_duration",
  sleep_dev: "sleep_duration",
  steps: "steps",
  steps_change_7d: "steps",
  steps_dev: "steps",
  active_minutes: "active_minutes",
  activity_dev: "active_minutes",
};

export default function DriversPage() {
  const params = useParams();
  const id = Number(params.id);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [baseline, setBaseline] = useState<PatientBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getPrediction(id),
      getPatientBaseline(id).catch(() => null),
    ])
      .then(([pred, bl]) => {
        setDrivers(pred.drivers);
        setBaseline(bl);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load drivers")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-[#64748b] animate-pulse text-lg py-20 text-center">
        Analyzing drivers...
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

  const maxContrib = Math.max(...drivers.map((d) => d.contribution_pct), 1);

  return (
    <div className="space-y-6">
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">
          Risk Drivers
        </h2>
        <p className="text-sm text-[#64748b] mb-6">
          Physiological factors contributing to the morning BP risk prediction,
          ranked by influence.
        </p>

        <div className="space-y-4">
          {drivers.map((d, i) => {
            const isIncreasing = d.direction === "increasing";
            const barColor = isIncreasing ? "#ef4444" : "#22c55e";
            const barWidth = (d.contribution_pct / maxContrib) * 100;

            const blKey = FEATURE_TO_BASELINE[d.feature];
            const dev = blKey && baseline?.deviations?.[blKey];

            return (
              <div key={i} className="group">
                <div className="flex items-center gap-4 mb-1.5">
                  <span className="text-xs text-[#64748b] w-5 text-right font-mono">
                    #{i + 1}
                  </span>
                  <span
                    className={`text-xl w-6 text-center ${
                      isIncreasing ? "text-[#ef4444]" : "text-[#22c55e]"
                    }`}
                  >
                    {isIncreasing ? "↑" : "↓"}
                  </span>
                  <span className="flex-1 text-sm font-medium">{d.label}</span>
                  <span className="text-sm font-mono text-[#94a3b8]">
                    {d.shap_value > 0 ? "+" : ""}
                    {d.shap_value.toFixed(3)}
                  </span>
                  <span className="text-sm font-semibold w-14 text-right">
                    {d.contribution_pct}%
                  </span>
                </div>
                <div className="ml-14 h-4 bg-[#1e293b] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: barColor,
                      opacity: 0.85,
                    }}
                  />
                </div>
                {dev && (
                  <div className="ml-14 mt-1 flex gap-4 text-[10px] font-mono text-[#64748b]">
                    <span>
                      Current: <span className="text-[#e2e8f0]">{dev.current.toFixed(1)}</span>
                    </span>
                    <span>
                      Baseline: <span className="text-[#94a3b8]">{dev.baseline.toFixed(1)}</span>
                    </span>
                    <span>
                      Z:{" "}
                      <span
                        style={{
                          color:
                            Math.abs(dev.z_score) < 1
                              ? "#22c55e"
                              : Math.abs(dev.z_score) < 2
                              ? "#f59e0b"
                              : "#ef4444",
                        }}
                      >
                        {dev.z_score > 0 ? "+" : ""}
                        {dev.z_score.toFixed(2)}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-6">
        <h3 className="text-sm font-semibold mb-3 text-[#94a3b8]">
          How to read this
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-[#64748b]">
          <div className="flex items-center gap-2">
            <span className="text-[#ef4444] text-base">{"↑"}</span>
            <span>Increasing risk — this factor pushes the prediction higher</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#22c55e] text-base">{"↓"}</span>
            <span>Decreasing risk — this factor is protective or normal</span>
          </div>
          <div>
            <span className="font-mono text-[#94a3b8]">SHAP value</span> — the
            signed contribution to the model&apos;s output for this patient
          </div>
          <div>
            <span className="font-semibold text-[#94a3b8]">%</span> — relative
            contribution as a percentage of total feature influence
          </div>
        </div>
      </div>
    </div>
  );
}
