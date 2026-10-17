"use client";

import { useRef, useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MatchOpponentMemory } from "@/components/matches/match-detail/match-opponent-memory";
import { MatchInsights } from "@/components/matches/match-insights/match-insights";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { useFixtureOperation, useDirtyCloseGuard } from "../../gate-a/shared/fixture-operation";
import { LineupSlotInspector, LineupSlotSheet, type LineupAssignmentSuccess } from "../../gate-a/a07-match-details-edit-lineup/shared/lineup-slot-editor";
import { matchBPlanningPitchSlots, matchBPlanningPitchAssignments, withTacticalAssignment, type MatchBSquadMember } from "../shared/match-b-fixture";
import {
  identity,
  matchIdentity,
  squad,
  opponentMemory,
  preparationInput,
  matchInsights,
  editSlotLabel,
  editCandidate,
  predeclaredOutcome,
} from "./fixtures";

/**
 * B01 — Before match planned, ready. Composition order and components are the real, already-
 * shipped ADR-0157 C3 ones fed with fixture data (`MatchIdentityCard`, `MatchPreparationWidget`,
 * `MatchOpponentMemory`, `MatchInsights`) plus the real A07 fixture-operation grammar for the
 * Edit Lineup local tactical editor (XR-I01). `MatchTacticsPanel`/`PlannedPlayingTimePanel`/
 * `CoachingIntentSelector` are NOT reused directly here — they self-fetch/mutate against the real
 * DB via server actions and are not fixture-injectable (same gap Gate A's A05/A08 already
 * disclosed for `AssistantCoachHypothesisPanel`, W4-BLK-10). See DATA_TRUTH_AND_FIXTURES.md.
 *
 * Design-audit correction (Phase 2): an earlier revision added a `DecisionBanner` restating
 * `MatchPreparationWidget`'s own "Ready for match: Ready" output in different words — a
 * duplicate-information violation. `MatchPreparationWidget` is the single real readiness surface;
 * the optional LCM swap is only ever surfaced inside the Edit lineup editor itself, not repeated
 * on the page. See VISUAL_VS_CURRENT.md.
 */
export default function B01PlannedReadyPage() {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const triggerRef = useRef<HTMLElement | null>(null);

  const op = useFixtureOperation<readonly MatchBSquadMember[], { playerId: string; position: CanonicalTacticalPosition }, LineupAssignmentSuccess>(
    squad,
    (authoritative, draft) => withTacticalAssignment(authoritative, draft.playerId, draft.position),
  );

  const close = () => {
    op.discardDraft();
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const guard = useDirtyCloseGuard(op.draft !== null, op.status === "PENDING", close);

  const openEditor = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const factsItems: MetricStripItem[] = [
    { id: "format", label: "Format", value: "7v7" },
    { id: "venue", label: "Venue", value: "Home" },
    { id: "type", label: "Type", value: "League" },
  ];

  const editorProps = {
    matchReference: `${matchIdentity.homeTeam} vs ${matchIdentity.awayTeam}`,
    slotLabel: editSlotLabel,
    pitchSlots: matchBPlanningPitchSlots(),
    pitchAssignments: matchBPlanningPitchAssignments(op.authoritative),
    candidate: editCandidate,
    isDraftSelected: op.draft !== null,
    onSelectCandidate: () => op.setDraft(op.draft ? null : { playerId: editCandidate.playerId, position: editSlotLabel }),
    status: op.status,
    outcome: op.outcome,
    onConfirm: () => op.submit(predeclaredOutcome),
    onResolvePending: op.resolvePending,
    onDiscardDraft: op.discardDraft,
    confirmingClose: guard.confirming,
    onRequestClose: guard.requestClose,
    onConfirmDiscardAndClose: guard.confirmDiscardAndClose,
    onCancelClose: guard.cancelConfirm,
  };

  return (
    <div className="touchline mx-auto flex max-w-[920px] flex-col gap-6 px-4 py-8 expanded:flex-row expanded:items-start" data-ui-lab-ready="true">
      <div className="flex min-w-0 flex-col gap-4 expanded:w-[560px] expanded:shrink-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gate B — B01 Before match, planned ready</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
        </div>

        <AppearanceControl />

        <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
          <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
            <MatchIdentityCard presentation={matchIdentity} ownKitColor="#C8102E" />
          </div>
          <MatchPreparationWidget input={preparationInput} />
        </div>

        <MatchOpponentMemory opponentMemory={opponentMemory} opponentTabHref="#opponent-context" />

        <MetricStrip items={factsItems} className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4" />

        <MatchInsights viewModel={matchInsights} />

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current plan</p>
          <TouchlinePlanningPitch slots={matchBPlanningPitchSlots()} assignments={matchBPlanningPitchAssignments(op.authoritative)} readOnly compact className="max-w-[320px]" />
          <button type="button" onClick={openEditor} className="self-start rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]">
            Edit lineup
          </button>
        </div>
      </div>

      {isOpen && isDesktop ? <LineupSlotInspector {...editorProps} className="expanded:flex-1" /> : null}
      {isOpen && !isDesktop ? <LineupSlotSheet isOpen={isOpen} {...editorProps} /> : null}
    </div>
  );
}
