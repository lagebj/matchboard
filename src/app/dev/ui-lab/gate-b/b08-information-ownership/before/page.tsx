import Link from "next/link";
import { Radio } from "lucide-react";
import { AppearanceControl, TouchlineButton } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { matchBPlanningPitchSlots, matchBPlanningPitchAssignments } from "../../shared/match-b-fixture";
import { B08TransitionNav } from "../shared/transition-nav";
import { b08BeforeIdentity, b08Squad, B08_OPPONENT_NAME, B08_COACHING_INTENT_NOTE } from "../shared/fixture";

/**
 * B08 — BEFORE (planned and ready).
 *
 * Same B01-style real presentational composition (`MatchIdentityCard`, `MatchPreparationWidget`,
 * real planning pitch) — no new readiness surface invented. Unlike B06 (which deliberately left
 * the live-entry action as a non-clickable fact because it was not demonstrating a transition),
 * B08's own acceptance question is specifically about moving between lifecycle workspaces, so the
 * primary action below is a REAL link into this candidate's own `/live` route, reproducing
 * `match-detail-shell.tsx`'s own shell-level CTA (not `BeforeMatchOverview` itself, which only
 * receives a boolean — confirmed in `docs/ui-lab/gate-b-w5-candidates/BLOCKERS.md`).
 *
 * Coaching intent is shown as a read-only fact (Class 1), not the real interactive
 * `CoachingIntentSelector` — that control self-fetches/mutates against the real DB and is not
 * fixture-injectable, the same gap B01's own doc comment already discloses.
 *
 * No post-match chronology or completed-report information appears anywhere on this page.
 */
export default function B08BeforePage() {
  const factsItems: MetricStripItem[] = [
    { id: "format", label: "Format", value: "7v7" },
    { id: "venue", label: "Venue", value: "Home" },
    { id: "origin", label: "Origin", value: "League" },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <div className="flex items-center gap-3">
          <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; Gate B
          </Link>
          <Link
            href="/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details"
            className="text-[12px] text-[var(--text-muted)] hover:underline"
          >
            &larr; League matches (navigation origin, B06 stand-in)
          </Link>
        </div>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B08 — Before match, planned and ready</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{b08BeforeIdentity.kickoffTime ?? "Kickoff pending"}</p>
      </div>

      <B08TransitionNav current="before" />
      <AppearanceControl />

      <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
        <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
          <MatchIdentityCard presentation={b08BeforeIdentity} ownKitColor="#C8102E" />
        </div>
        <MatchPreparationWidget input={{ squadSelectedCount: 8, squadTarget: 8, hasLineup: true, hasPlannedRotation: true }} />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Coaching intent</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">{B08_COACHING_INTENT_NOTE}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current plan</p>
        <TouchlinePlanningPitch
          slots={matchBPlanningPitchSlots()}
          assignments={matchBPlanningPitchAssignments(b08Squad)}
          readOnly
          compact
          className="max-w-[320px]"
        />
        <p className="text-[12px] text-[var(--text-muted)]">
          {b08BeforeIdentity.homeTeam} vs {B08_OPPONENT_NAME}.
        </p>
      </div>

      <div>
        <TouchlineButton
          as={Link}
          href="/dev/ui-lab/gate-b/b08-information-ownership/live"
          variant="primary"
          size="sm"
          leadingIcon={<Radio className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Start live reporting
        </TouchlineButton>
      </div>
    </div>
  );
}
