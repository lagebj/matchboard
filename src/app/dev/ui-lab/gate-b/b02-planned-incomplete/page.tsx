"use client";

import { AppearanceControl } from "@/components/touchline";
import { TouchlinePlanningPitch } from "@/components/touchline/pitch/touchline-planning-pitch";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MatchOpponentMemory } from "@/components/matches/match-detail/match-opponent-memory";
import { MatchInsights } from "@/components/matches/match-insights/match-insights";
import { matchBPlanningPitchSlots, matchBPlanningPitchAssignments } from "../shared/match-b-fixture";
import { identity, matchIdentity, squad, preparationInput, opponentMemory, matchInsights } from "./fixtures";

/**
 * B02 — Before match planned, incomplete. Same real composition as B01 (`MatchIdentityCard`,
 * `MatchPreparationWidget`, `MatchOpponentMemory`, `MatchInsights`) fed a genuinely incomplete
 * fixture. No Edit Lineup interaction is offered here — there is no lineup yet to edit, which is
 * itself the honest state, not a disabled/greyed-out button pretending one exists.
 */
export default function B02PlannedIncompletePage() {
  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Gate B — B02 Before match, planned incomplete</p>
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

      <MatchInsights viewModel={matchInsights} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Current plan</p>
        <TouchlinePlanningPitch slots={matchBPlanningPitchSlots()} assignments={matchBPlanningPitchAssignments(squad)} readOnly compact className="max-w-[320px]" />
        <p className="text-[13px] text-[var(--text-muted)]">Lineup not set — no positions have been assigned yet.</p>
      </div>

      <DecisionBanner
        variant="decision"
        title="Select the remaining squad and set a lineup"
        description="5 of 8 planned players selected, no positions assigned. This is missing planning, not a permission or data error."
      />
    </div>
  );
}
