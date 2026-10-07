import Link from "next/link";
import { AppearanceControl, TouchlinePageHeader } from "@/components/touchline";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MatchFlowPanel } from "@/components/matches/match-detail/match-flow-panel";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import { WhatThisMatchAddedPanel } from "@/components/matches/match-detail/what-this-match-added-panel";
import { completedMatchFixture } from "./fixtures";

/**
 * ADR-0157 C9 golden-state fixture — Completed Match, desktop
 * (`15_TEST_AND_ACCEPTANCE_MATRIX.md` golden state 6). Renders the real production C6 panels
 * (`MatchFlowPanel`, `MatchTimelineList`, `WhatThisMatchAddedPanel`) against deterministic data
 * built through the same pure story builders the production route uses. The plan-vs-reality
 * section is intentionally not rendered here: `PlanVsRealityPanel` self-fetches its projection
 * from a live match via a server action, which a static fixture cannot and should not exercise —
 * the same convention as the Round Board fixture's documented drag/drop exclusion.
 */
export default function CompletedMatchFixturePage() {
  const f = completedMatchFixture;

  return (
    <div className="touchline mx-auto flex max-w-[960px] flex-col gap-5 px-4 py-6 medium:max-w-[1180px]">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <AppearanceControl />

      <TouchlinePageHeader
        title={`${f.ownTeamName} ${f.finalScore} ${f.opponentName}`}
        context="Completed match — factual story, plan vs reality, and what this match added."
      />

      <MatchFlowPanel timeline={f.timeline} ownTeamName={f.ownTeamName} opponentName={f.opponentName} />

      <Surface padding="md">
        <SectionHeader title="Match story" description="Recorded events in canonical order." />
        <div className="mt-2">
          <MatchTimelineList items={f.timeline} ownTeamName={f.ownTeamName} opponentName={f.opponentName} />
        </div>
      </Surface>

      {f.shapeChangeRows.length > 0 && (
        <Surface padding="md">
          <SectionHeader
            title="Shape changes"
            description="Concrete on-pitch position changes — no guessed formation labels."
          />
          <ul className="mt-2 flex flex-col gap-1.5">
            {f.shapeChangeRows.flatMap((row) =>
              row.changes.map((change) => (
                <li key={`${row.id}:${change.playerId}`} className="flex items-start gap-2 text-[13px] text-[var(--foreground)]">
                  <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
                  <span>
                    {change.playerName}: {change.fromPosition} → {change.toPosition}
                    {row.minuteLabel ? ` (${row.minuteLabel})` : ""}
                  </span>
                </li>
              )),
            )}
          </ul>
        </Surface>
      )}

      <WhatThisMatchAddedPanel input={f.whatThisMatchAddedInput} />
    </div>
  );
}