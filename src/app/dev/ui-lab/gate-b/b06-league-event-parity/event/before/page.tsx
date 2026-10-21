import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { cn } from "@/lib/cn";
import { matchBPlanningPitchSlots, b06EventPlanningPitchAssignments } from "../../../shared/match-b-fixture";
import { CompareNav } from "../../shared/compare-nav";
import { identity, matchIdentity, participants, eventName, eventSquadName, opponentName } from "./fixtures";

/**
 * B06 — Event · Before (planned, ready). Production has no dedicated Event Match Details route —
 * this page is a UI-Lab-local DESIGN PROPOSAL for what a comparable standalone layout could look
 * like, composed from real production pieces (`MatchIdentityCard`, `TouchlinePlanningPitch`, the
 * real `buildPlanningPitchAssignments` projection) rather than a copy of `EventMatchesTab`. It is
 * not an authorization to build that route — see SOURCE_RECONCILIATION.md.
 */
export default function B06EventBeforePage() {
  const factsItems: MetricStripItem[] = [
    { id: "format", label: "Format", value: "7v7" },
    { id: "venue", label: "Venue", value: "Home" },
    { id: "origin", label: "Origin", value: "Event" },
  ];

  const unassigned = participants.filter((p) => p.tacticalPosition === null);

  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <div className="flex items-center gap-3">
          <Link href="/dev/ui-lab/gate-b" className="text-[12px] text-[var(--text-muted)] hover:underline">
            &larr; Gate B
          </Link>
          <Link
            href="/dev/ui-lab/gate-b/b06-league-event-parity/event/event-detail"
            className="text-[12px] text-[var(--text-muted)] hover:underline"
          >
            &larr; Event Detail
          </Link>
        </div>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">B06 — Event · Before match, planned ready</h1>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <CompareNav active="event-before" />
      <AppearanceControl />

      <DecisionBanner
        variant="note"
        title="Design proposal, not a production route"
        description={`Production today renders this content inline on Event Detail's Matches tab (${eventName}), not as a standalone page. This layout is a UI Lab comparison, not an implemented or authorized route.`}
      />

      <p className="text-[12px] text-[var(--text-muted)]">
        Event: <span className="font-[600] text-[var(--foreground)]">{eventName}</span> · Squad:{" "}
        <span className="font-[600] text-[var(--foreground)]">{eventSquadName}</span>
      </p>

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={matchIdentity} ownKitColor={null} />
      </div>

      <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current plan</p>
        <TouchlinePlanningPitch
          slots={matchBPlanningPitchSlots()}
          assignments={b06EventPlanningPitchAssignments(participants)}
          readOnly
          compact
          className="max-w-[320px]"
        />
        <p className="text-[12px] text-[var(--text-muted)]">
          Neutral shirt, not a missing colour — Event squads have no kit colour at all, unlike League&apos;s real
          kit colour above.
        </p>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Eligible participants
        </p>
        <div className="flex flex-wrap gap-1">
          {participants.map((p) => (
            <span
              key={p.participantId}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px]",
                p.source === "helper"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-soft)]",
              )}
            >
              {p.displayName}
              {p.tacticalPosition ? ` · ${p.tacticalPosition}` : " · Reserve"}
              {p.source === "helper" && <span className="ml-1 text-amber-400">H</span>}
              {p.participantType === "GUEST_PLAYER" && (
                <span className="ml-1 text-[var(--text-muted)]" title="Guest player">
                  Guest
                </span>
              )}
            </span>
          ))}
        </div>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          {unassigned.length} reserve, {participants.length - unassigned.length} on the pitch — one approved helper
          (Jonas, borrowed from Slemmestad Blå) and one guest player (William).
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5">
        <p className="text-[12px] text-[var(--text-muted)]">
          <span className="font-[650] text-[var(--foreground)]">Primary action in production:</span> &ldquo;Start live
          reporting&rdquo; (match card on Event Detail&apos;s Matches tab) navigates to the same shared
          live-reporting surface League uses. Not reproduced in this candidate — see League · Before.
        </p>
      </div>

      <p className="text-[12px] text-[var(--text-muted)]">vs {opponentName}</p>
    </div>
  );
}
