"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineButton } from "@/components/touchline";
import { runAiBackfillAction } from "./ai-backfill-actions";
import type { AiBackfillReport } from "@/lib/evidence/qualitative-evidence-backfill";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  POST_MATCH_TEAM_NOTE: "Report team notes",
  TEAM_REFLECTION_NOTE: "Legacy team reflections",
  MATCH_NOTE: "Match notes",
  QUICK_OBSERVATION: "Quick observations",
  OPPONENT_ENCOUNTER_TEXT: "Opponent encounter summaries",
};

/**
 * "Run AI analysis on existing data" (ADR-0152 Slice 7). Transient admin tool, deliberately
 * matching the sibling "Rebuild historical evidence" / "Populate opponent levels" tools'
 * structure: one explanatory card, one confirm-gated button, one structured result block.
 */
export function AiBackfillContent({ orgSlug }: { orgSlug: string }) {
  const [result, setResult] = useState<AiBackfillReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    if (
      !confirm(
        "This will queue the AI Assistant Coach for existing data: structuring legacy free-text notes into qualitative evidence, and reviews for completed matches, weeks, and learning cycles within the last 90 days. Nothing is analysed synchronously and nothing is re-run for data that has not changed. It is safe to run more than once. Continue?",
      )
    ) {
      return;
    }
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const report = await runAiBackfillAction(orgSlug);
        setResult(report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return (
    // Touchline island (theme-aware — matches the sibling advanced-tool pages).
    <div className="touchline flex flex-col gap-6">
      <SectionHeader
        title="Run AI analysis on existing data"
        description="Queue the AI Assistant Coach for matches, weeks, and notes that already exist. This is a transient migration tool."
      />

      <Surface>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-[var(--text-muted)]">
            Matchboard will queue AI work for this organisation&apos;s existing data: unstructured
            coach text (report team notes, legacy team reflections, match notes, quick
            observations, opponent summaries) is queued for structuring into reusable evidence,
            and Assistant Coach reviews are queued for completed matches, each finished week, and
            eligible learning cycles within the last 90 days. Reviews only run for the
            capabilities currently enabled in AI Advisor settings. Nothing runs immediately —
            the scheduled AI worker picks the queued work up — and rerunning is safe: data that
            has not changed is never re-analysed, so a second run only queues what is new.
          </p>

          <div>
            <TouchlineButton variant="primary" onClick={handleRun} disabled={isPending}>
              {isPending ? "Queueing..." : "Run AI analysis on existing data"}
            </TouchlineButton>
          </div>

          {error && <div className="rounded-md bg-[var(--danger-subtle)] p-3 text-sm text-[var(--danger)]">{error}</div>}

          {result && <BackfillResult report={result} />}
        </div>
      </Surface>
    </div>
  );
}

function BackfillResult({ report }: { report: AiBackfillReport }) {
  const extractionRows = report.extraction.filter((s) => s.considered > 0);
  const extractionEnqueued = report.extraction.reduce((n, s) => n + s.enqueued, 0);
  const extractionAlreadyTracked = report.extraction.reduce((n, s) => n + s.alreadyTracked, 0);
  const extractionOutOfBudget = report.extraction.reduce((n, s) => n + s.outOfBudget, 0);

  return (
    <div className="rounded-md border p-4">
      <h3 className="mb-2 font-medium">Result</h3>
      {report.aiDisabled ? (
        <p className="text-sm text-[var(--text-muted)]">
          AI is not enabled for this organisation, so nothing was queued. Connect a provider and
          enable the AI Advisor first — existing text is preserved and can be queued later.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt className="text-[var(--text-muted)]">Window</dt>
          <dd>
            {report.window.from.toLocaleDateString("en-GB")} – {report.window.to.toLocaleDateString("en-GB")}
          </dd>
          <dt className="text-[var(--text-muted)]">Notes queued for structuring</dt>
          <dd>
            {extractionEnqueued} queued · {extractionAlreadyTracked} already processed
            {extractionOutOfBudget > 0 ? ` · ${extractionOutOfBudget} deferred (batch limit)` : ""}
          </dd>
          <dt className="text-[var(--text-muted)]">Completed matches considered</dt>
          <dd>
            {report.advisor.lockedMatchesConsidered} · {report.advisor.matchReviewsEnqueued} review
            {report.advisor.matchReviewsEnqueued === 1 ? "" : "s"} queued
          </dd>
          <dt className="text-[var(--text-muted)]">Weeks considered</dt>
          <dd>
            {report.advisor.weeksConsidered} · {report.advisor.weeklyReviewsEnqueued} weekly review
            {report.advisor.weeklyReviewsEnqueued === 1 ? "" : "s"} queued
          </dd>
          <dt className="text-[var(--text-muted)]">Learning cycles</dt>
          <dd>
            {report.advisor.developmentCycleScanned} team
            {report.advisor.developmentCycleScanned === 1 ? "" : "s"} scanned ·{" "}
            {report.advisor.developmentCycleEnqueued} eligible
          </dd>
        </dl>
      )}

      {extractionRows.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1 text-sm font-medium">Notes by source</h4>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            {extractionRows.map((s) => (
              <li key={s.sourceType}>
                {SOURCE_TYPE_LABELS[s.sourceType] ?? s.sourceType}: {s.enqueued} queued, {s.alreadyTracked} already
                processed{s.outOfBudget > 0 ? `, ${s.outOfBudget} deferred` : ""}
                {s.failed > 0 ? `, ${s.failed} failed` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Queued work runs through the scheduled AI worker. Reviews only run for capabilities
        enabled in AI Advisor settings.
      </p>
    </div>
  );
}