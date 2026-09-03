"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { rebuildHistoricalEvidenceAction } from "./evidence-rebuild-actions";
import type { PostMatchLearningReplaySummary } from "@/lib/evidence/post-match-learning-replay";

export function EvidenceRebuildContent({ orgSlug }: { orgSlug: string }) {
  const [result, setResult] = useState<PostMatchLearningReplaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    if (
      !confirm(
        "This will reprocess every completed League and Event match for this organisation through the current evidence engine. It does not change any historical match report and is safe to rerun. Continue?",
      )
    ) {
      return;
    }
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const summary = await rebuildHistoricalEvidenceAction(orgSlug);
        setResult(summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Rebuild historical evidence"
        description="Reprocess completed matches through the current evidence engine. This is a transient migration tool."
      />

      <Surface>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm text-muted-foreground">
            Matchboard will process every completed League and Event match for this organisation
            through the current evidence engine — the same pipeline a match already goes through
            the moment its report is completed. Evidence can only be created from facts that were
            recorded in those matches; this does not improve data that was never recorded. It does
            not change any historical match report, planned rotation, starting line-up, attendance,
            scoreline, or audit history — only derived evidence is rebuilt. It is safe to run more
            than once: reruns upsert cleanly and one match failing to process does not affect any
            other match.
          </p>

          <div>
            <Button variant="primary" onClick={handleRun} disabled={isPending}>
              {isPending ? "Rebuilding..." : "Rebuild historical evidence"}
            </Button>
          </div>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {result && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Result</h3>
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-muted-foreground">Matches processed</dt>
                <dd>{result.totalMatches}</dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{result.applied}</dd>
                <dt className="text-muted-foreground">Skipped</dt>
                <dd>{result.skipped}</dd>
                <dt className="text-muted-foreground">Failed</dt>
                <dd>{result.failed}</dd>
                <dt className="text-muted-foreground">League matches</dt>
                <dd>
                  {result.bySource.league.total} processed, {result.bySource.league.applied} updated,{" "}
                  {result.bySource.league.failed} failed
                </dd>
                <dt className="text-muted-foreground">Event matches</dt>
                <dd>
                  {result.bySource.event.total} processed, {result.bySource.event.applied} updated,{" "}
                  {result.bySource.event.failed} failed
                </dd>
              </dl>

              {result.failed > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-1 text-sm">Failed matches</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {result.details
                      .filter((d) => d.outcome === "FAILED")
                      .map((d) => (
                        <li key={d.sourceId}>
                          {d.kind === "LEAGUE_MATCH" ? "League" : "Event"} match {d.sourceId}
                          {d.error ? `: ${d.error}` : ""}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}
