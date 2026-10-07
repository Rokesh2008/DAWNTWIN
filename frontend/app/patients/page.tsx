"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPatients, seedData, trainModel } from "@/lib/api";
import type { PatientSummary } from "@/lib/types";

function cvColor(val: number | null): string {
  if (val === null) return "#64748b";
  if (val >= 70) return "#22c55e";
  if (val >= 50) return "#f59e0b";
  return "#ef4444";
}

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [filtered, setFiltered] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterHTN, setFilterHTN] = useState(false);
  const [filterDM, setFilterDM] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [training, setTraining] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPatients();
      setPatients(data);
      setFiltered(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    let result = patients;
    if (search) {
      const q = search.toLowerCase();
      const num = parseInt(q, 10);
      if (!isNaN(num)) {
        result = result.filter((p) => p.id === num);
      } else {
        result = result.filter(
          (p) =>
            p.sex.toLowerCase().includes(q) ||
            String(p.age).includes(q)
        );
      }
    }
    if (filterHTN) result = result.filter((p) => p.hypertension);
    if (filterDM) result = result.filter((p) => p.diabetes);
    setFiltered(result);
  }, [search, filterHTN, filterDM, patients]);

  const handleSeed = async () => {
    setSeeding(true);
    setActionMsg(null);
    try {
      await seedData();
      setActionMsg("Data seeded successfully.");
      await fetchPatients();
    } catch {
      setActionMsg("Failed to seed data.");
    } finally {
      setSeeding(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setActionMsg(null);
    try {
      await trainModel();
      setActionMsg("Model trained successfully.");
    } catch {
      setActionMsg("Failed to train model.");
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-mono">Patient Registry</h1>
          <p className="text-sm text-[#64748b] font-mono mt-1">
            {patients.length} patients in database
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-[#1e293b] border border-[#334155] rounded text-xs font-mono hover:bg-[#334155] transition disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Seed Data"}
          </button>
          <button
            onClick={handleTrain}
            disabled={training}
            className="px-4 py-2 bg-[#3b82f6] rounded text-xs font-mono hover:bg-[#2563eb] transition disabled:opacity-50"
          >
            {training ? "Training..." : "Train Model"}
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-[#111827] border border-[#1e293b] rounded text-sm font-mono text-[#94a3b8]">
          {actionMsg}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by patient ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-[#111827] border border-[#1e293b] rounded px-4 py-2 text-sm font-mono text-white placeholder-[#64748b] focus:border-[#3b82f6] outline-none"
        />
        <button
          onClick={() => setFilterHTN(!filterHTN)}
          className={`px-3 py-2 rounded text-xs font-mono border transition ${
            filterHTN
              ? "bg-[#ef4444]/15 border-[#ef4444]/30 text-[#ef4444]"
              : "bg-[#111827] border-[#1e293b] text-[#64748b] hover:text-white"
          }`}
        >
          HTN
        </button>
        <button
          onClick={() => setFilterDM(!filterDM)}
          className={`px-3 py-2 rounded text-xs font-mono border transition ${
            filterDM
              ? "bg-[#f59e0b]/15 border-[#f59e0b]/30 text-[#f59e0b]"
              : "bg-[#111827] border-[#1e293b] text-[#64748b] hover:text-white"
          }`}
        >
          DM
        </button>
      </div>

      {loading && (
        <div className="text-[#64748b] animate-pulse font-mono py-10 text-center">
          Loading patients...
        </div>
      )}

      {error && (
        <div className="text-[#ef4444] font-mono mb-4">
          {error}{" "}
          <button onClick={fetchPatients} className="underline ml-2">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-[#111827] border border-[#1e293b] rounded-lg overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-[#1e293b] text-[#64748b] text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Age</th>
                <th className="text-left px-4 py-3">Sex</th>
                <th className="text-left px-4 py-3">BMI</th>
                <th className="text-left px-4 py-3">CV State</th>
                <th className="text-left px-4 py-3">Conditions</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30 transition cursor-pointer"
                  onClick={() => router.push(`/patient/${p.id}`)}
                >
                  <td className="px-4 py-3 text-[#3b82f6]">#{p.id}</td>
                  <td className="px-4 py-3">{p.age}y</td>
                  <td className="px-4 py-3">{p.sex}</td>
                  <td className="px-4 py-3">{p.bmi}</td>
                  <td className="px-4 py-3">
                    {p.cardiovascular_state !== null ? (
                      <span style={{ color: cvColor(p.cardiovascular_state) }}>
                        {Math.round(p.cardiovascular_state)}
                      </span>
                    ) : (
                      <span className="text-[#475569]">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {p.hypertension && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ef4444]/15 text-[#ef4444]">
                          HTN
                        </span>
                      )}
                      {p.diabetes && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b]">
                          DM
                        </span>
                      )}
                      {p.family_cvd && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#8b5cf6]/15 text-[#8b5cf6]">
                          CVD
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/?patient=${p.id}`);
                      }}
                      className="text-xs text-[#3b82f6] hover:text-white transition"
                    >
                      Dashboard &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-[#64748b] font-mono text-sm">
              No patients match your search.
            </div>
          )}
        </div>
      )}

      {!loading && patients.length === 0 && !error && (
        <div className="text-center text-[#64748b] py-20 font-mono">
          <p className="text-lg mb-2">No patients found.</p>
          <p className="text-sm">
            Click &quot;Seed Data&quot; to generate synthetic patients.
          </p>
        </div>
      )}
    </div>
  );
}
