import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { matchBPlanningPitchSlots, matchBPlanningPitchAssignments, MATCH_B_TEAM_KIT_COLOR } from "../../../shared/match-b-fixture";
import { CompareNav } from "../../shared/compare-nav";
import { identity, matchIdentity, squad, opponentName, preparationInput } from "./fixtures";

/**
 * B06 — League · Before (planned, ready). Same route composition B01 already established
 * (`MatchIdentityCard`, `MatchPreparationWidget`, real planning pitch) — this candidate confirms
 * the shipped League Match Details BEFORE composition as the comparison baseline, not a redesign.
 * Primary action ("Start live reporting") is rendered as a labelled fact, not a clickable button —
 * League and Event share the exact same Live Reporting surface
 * (`src/components/live-match/live-match-client.tsx`), so reproducing it here would duplicate
 * already-shared production code rather than compare anything (see CURRENT_STATE_AUDIT.md).
 */
export default function B06LeagueBeforePage() {
  const factsItems: MetricStripItem[] = [
    { id: "format", label: "Format", value: "7v7" },
    { id: "venue", label: "Venue", value: "Home" },
    { id: "origin", label: "Origin", value: "League" },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; Gate B
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B06 — League · Before match, planned ready</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <CompareNav active="league-before" />
      <AppearanceControl />

      <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
        <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
          <MatchIdentityCard presentation={matchIdentity} ownKitColor={MATCH_B_TEAM_KIT_COLOR} />
        </div>
        <MatchPreparationWidget input={preparationInput} />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current plan</p>
        <TouchlinePlanningPitch
          slots={matchBPlanningPitchSlots()}
          assignments={matchBPlanningPitchAssignments(squad)}
          readOnly
          compact
          className="max-w-[320px]"
        />
        <p className="text-[12px] text-[var(--text-muted)]">
          Squad kit colour is always real for League — {matchIdentity.homeTeam} vs {opponentName}.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5">
        <p className="text-[12px] text-[var(--text-muted)]">
          <span className="font-[650] text-[var(--foreground)]">Primary action in production:</span> &ldquo;Start live
          reporting&rdquo; navigates to <code>/o/[orgSlug]/matches/[matchId]/live</code> once{" "}
          <code>canStartLiveReporting()</code> passes — the same shared live-reporting surface Event uses. Not
          reproduced in this candidate.
        </p>
      </div>
    </div>
  );
}
