"use client";

import { useState } from "react";
import { formatGameFormatShort } from "@/lib/formations/types";

type EvidenceRow = {
  id: string;
  matchId: string;
  occurredAt: string;
  gameFormat: string | null;
  goalsFor: number;
  goalsAgainst: number;
  fieldedRatingSnapshot: number | null;
  estimate: number;
  excludedAt: string | null;
  exclusionReason: string | null;
  weightingMethod: string;
  formulaVersion: string;
};

type AggregateData = {
  estimatedLevel: number;
  confidence: string;
  validEncounterCount: number;
  lastEncounterDate: string | null;
  gameFormat: string | null;
};

type Props = {
  opponentTeamId: string;
  initialAggregate: AggregateData | null;
  initialEvidence: EvidenceRow[];
};

const CONFIDENCE_LABELS: Record<string, string> = {
  unknown: "Unknown",
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function SportingLevelSection({ initialAggregate, initialEvidence }: Props) {
  const [evidence, setEvidence] = useState<EvidenceRow[]>(initialEvidence);
  const [excluding, setExcluding] = useState<string | null>(null);
  const [including, setIncluding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExclude(evidenceId: string) {
    setExcluding(evidenceId);
    setError(null);
    try {
      const res = await fetch("/api/opponents/evidence/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId, reason: "Coach manual exclusion" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to exclude evidence");
        return;
      }
      setEvidence((prev) =>
        prev.map((e) =>
          e.id === evidenceId ? { ...e, excludedAt: new Date().toISOString(), exclusionReason: "Coach manual exclusion" } : e,
        ),
      );
    } catch {
      setError("Failed to exclude evidence");
    } finally {
      setExcluding(null);
    }
  }

  async function handleInclude(evidenceId: string) {
    setIncluding(evidenceId);
    setError(null);
    try {
      const res = await fetch("/api/opponents/evidence/include", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to include evidence");
        return;
      }
      setEvidence((prev) =>
        prev.map((e) =>
          e.id === evidenceId ? { ...e, excludedAt: null, exclusionReason: null } : e,
        ),
      );
    } catch {
      setError("Failed to include evidence");
    } finally {
      setIncluding(null);
    }
  }

  const activeEvidence = evidence.filter((e) => !e.excludedAt);
  const excludedEvidence = evidence.filter((e) => !!e.excludedAt);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-50">Sporting level estimate</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Evidence-derived opponent sporting estimate. Not a fixed label or rating.
        </p>
      </div>

      {initialAggregate ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Estimated level</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">{initialAggregate.estimatedLevel.toFixed(1)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Confidence</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">
              {CONFIDENCE_LABELS[initialAggregate.confidence] ?? initialAggregate.confidence}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Valid encounters</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">{initialAggregate.validEncounterCount}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Last encounter</p>
            <p className="mt-1 text-sm text-zinc-50">
              {initialAggregate.lastEncounterDate
                ? new Date(initialAggregate.lastEncounterDate).toLocaleDateString()
                : "\u2014"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No valid sporting evidence available for this opponent.</p>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {activeEvidence.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Active evidence</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Format</th>
                  <th className="pb-2 pr-4">Score</th>
                  <th className="pb-2 pr-4">Fielded rating</th>
                  <th className="pb-2 pr-4">Estimate</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {activeEvidence.map((e) => (
                  <tr key={e.id} className="text-zinc-200">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">{e.gameFormat ? formatGameFormatShort(e.gameFormat) : "\u2014"}</td>
                    <td className="py-2 pr-4">{`${e.goalsFor}\u2013${e.goalsAgainst}`}</td>
                    <td className="py-2 pr-4">{e.fieldedRatingSnapshot?.toFixed(2) ?? "\u2014"}</td>
                    <td className="py-2 pr-4 font-medium">{e.estimate.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-xs text-zinc-400">{e.weightingMethod.replaceAll("_", " ").toLowerCase()}</td>
                    <td className="py-2">
                      <button
                        onClick={() => handleExclude(e.id)}
                        disabled={excluding === e.id}
                        className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                      >
                        {excluding === e.id ? "Excluding\u2026" : "Exclude"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {excludedEvidence.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Excluded evidence</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Score</th>
                  <th className="pb-2 pr-4">Estimate</th>
                  <th className="pb-2 pr-4">Reason</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {excludedEvidence.map((e) => (
                  <tr key={e.id} className="text-zinc-500 line-through">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(e.occurredAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">{`${e.goalsFor}\u2013${e.goalsAgainst}`}</td>
                    <td className="py-2 pr-4">{e.estimate.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-xs max-w-[200px] truncate" title={e.exclusionReason ?? undefined}>
                      {e.exclusionReason ?? "\u2014"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleInclude(e.id)}
                        disabled={including === e.id}
                        className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                      >
                        {including === e.id ? "Including\u2026" : "Re-include"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500 italic">
        Sporting estimates are evidence-derived planning context, not fixed labels or ratings.
        Excluded encounters are not used in aggregation.
      </p>
    </div>
  );
}