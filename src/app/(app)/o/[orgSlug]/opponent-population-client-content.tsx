"use client";

import { useState } from "react";
import { TouchlineButton } from "@/components/touchline";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import type { HistoricalDryRunResult } from "@/lib/evidence/opponent-engine";
import type { ApplyResult } from "@/lib/evidence/opponent-replay";

type DryRunResult = HistoricalDryRunResult;

export function OpponentPopulationContent({ orgSlug }: { orgSlug: string }) {
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDryRun() {
    setLoading(true);
    setError(null);
    setDryRunResult(null);
    try {
      const result = await fetch(`/api/admin/opponent-population?orgSlug=${orgSlug}&mode=dryrun`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      setDryRunResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!confirm("This will populate opponent sporting levels for all eligible historical matches. Continue?")) {
      return;
    }
    setLoading(true);
    setError(null);
    setApplyResult(null);
    try {
      const result = await fetch(`/api/admin/opponent-population?orgSlug=${orgSlug}&mode=apply`, {
        method: "POST",
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      setApplyResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="touchline flex flex-col gap-6">
      <SectionHeader title="Populate opponent levels" description="Populate opponent sporting level evidence from historical match data. This is a one-time migration tool." />

      <Surface>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-[var(--text-muted)]">
            This tool processes completed post-match reports — League and Event matches alike — and
            creates opponent sporting level evidence for matches that were played before the opponent
            engine was active. Use dry-run first to preview the results, then apply to persist them.
          </p>

          <div className="flex gap-3">
            <TouchlineButton variant="secondary" onClick={handleDryRun} disabled={loading}>
              {loading && !applyResult ? "Processing..." : "Dry run"}
            </TouchlineButton>
            <TouchlineButton variant="primary" onClick={handleApply} disabled={loading}>
              {loading && !dryRunResult ? "Applying..." : "Apply to history"}
            </TouchlineButton>
          </div>

          {error && (
            <div className="rounded-md bg-[var(--danger-subtle)] p-3 text-sm text-[var(--danger)]">{error}</div>
          )}

          {dryRunResult && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Dry run results</h3>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-[var(--text-muted)]">Matches inspected</dt>
                <dd>{dryRunResult.matchesInspected}</dd>
                <dt className="text-[var(--text-muted)]">Matches eligible</dt>
                <dd>{dryRunResult.matchesEligible}</dd>
                <dt className="text-[var(--text-muted)]">Evidence would be created</dt>
                <dd>{dryRunResult.evidenceCreated}</dd>
                <dt className="text-[var(--text-muted)]">Evidence skipped</dt>
                <dd>{dryRunResult.evidenceSkipped}</dd>
                <dt className="text-[var(--text-muted)]">Opponents affected</dt>
                <dd>{dryRunResult.opponentsAffected}</dd>
                <dt className="text-[var(--text-muted)]">Exclusions</dt>
                <dd>{dryRunResult.exclusions.length}</dd>
              </dl>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                League matches inspected: {dryRunResult.bySource.league.inspected} ({dryRunResult.bySource.league.eligible} eligible) ·
                {" "}Event matches inspected: {dryRunResult.bySource.event.inspected} ({dryRunResult.bySource.event.eligible} eligible)
              </p>
              {dryRunResult.exclusions.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium mb-1">Exclusions</h4>
                  <ul className="text-xs text-[var(--text-muted)] space-y-1">
                    {dryRunResult.exclusions.slice(0, 20).map((e, i) => (
                      <li key={i}>{e.matchId}: {e.reason}</li>
                    ))}
                    {dryRunResult.exclusions.length > 20 && (
                      <li>...and {dryRunResult.exclusions.length - 20} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {applyResult && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Apply results</h3>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-[var(--text-muted)]">Total eligible matches</dt>
                <dd>{applyResult.totalMatches}</dd>
                <dt className="text-[var(--text-muted)]">Processed</dt>
                <dd>{applyResult.processed}</dd>
                <dt className="text-[var(--text-muted)]">Evidence recorded</dt>
                <dd>{applyResult.recorded}</dd>
                <dt className="text-[var(--text-muted)]">Already recorded (skipped)</dt>
                <dd>{applyResult.skipped}</dd>
                <dt className="text-[var(--text-muted)]">Failed</dt>
                <dd>{applyResult.failed}</dd>
              </dl>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                League: {applyResult.bySource.league.recorded} recorded, {applyResult.bySource.league.skipped} skipped, {applyResult.bySource.league.failed} failed ·
                {" "}Event: {applyResult.bySource.event.recorded} recorded, {applyResult.bySource.event.skipped} skipped, {applyResult.bySource.event.failed} failed
              </p>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}