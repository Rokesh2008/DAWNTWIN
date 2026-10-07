"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { getPatient } from "@/lib/api";
import type { PatientDetail } from "@/lib/types";

const TABS = [
  { label: "Overview", suffix: "" },
  { label: "Twin State", suffix: "/twin" },
  { label: "Drivers", suffix: "/drivers" },
  { label: "Simulate", suffix: "/simulate" },
];

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const id = Number(params.id);
  const [patient, setPatient] = useState<PatientDetail | null>(null);

  useEffect(() => {
    if (id) getPatient(id).then(setPatient).catch(() => {});
  }, [id]);

  const basePath = `/patient/${id}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="flex items-center gap-4 mb-4">
        <Link
          href="/"
          className="text-xs font-mono text-[#64748b] hover:text-[#94a3b8] transition"
        >
          &larr; Dashboard
        </Link>
        <Link
          href="/patients"
          className="text-xs font-mono text-[#64748b] hover:text-[#94a3b8] transition"
        >
          All Patients
        </Link>
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-mono">Patient #{id}</h1>
            {patient && (
              <div className="flex items-center gap-4 mt-1 text-[#94a3b8] text-xs font-mono">
                <span>{patient.age}y {patient.sex === "M" ? "Male" : "Female"}</span>
                <span>BMI {patient.bmi}</span>
                {patient.height_cm && <span>{patient.height_cm}cm</span>}
                {patient.weight_kg && <span>{patient.weight_kg}kg</span>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {patient?.hypertension && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444] font-mono">
                HTN
              </span>
            )}
            {patient?.diabetes && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] font-mono">
                DM
              </span>
            )}
            {patient?.dyslipidemia && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#a855f7]/15 text-[#a855f7] font-mono">
                DLP
              </span>
            )}
            {patient?.family_cvd && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#8b5cf6]/15 text-[#8b5cf6] font-mono">
                FamCVD
              </span>
            )}
            {patient?.smoking_status && patient.smoking_status !== "never" && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#64748b]/15 text-[#94a3b8] font-mono">
                Smoker
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-[#111827] border border-[#1e293b] rounded-lg p-1">
        {TABS.map((tab) => {
          const href = basePath + tab.suffix;
          const isActive =
            tab.suffix === ""
              ? pathname === basePath
              : pathname === href;
          return (
            <Link
              key={tab.suffix}
              href={href}
              className={`px-4 py-2 rounded text-xs font-mono transition ${
                isActive
                  ? "bg-[#3b82f6] text-white"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
