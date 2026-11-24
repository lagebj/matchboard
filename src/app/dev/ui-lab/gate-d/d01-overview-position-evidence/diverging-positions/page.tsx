import Link from "next/link";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { AppearanceControl } from "@/components/touchline";
import { PlayerCurrentStoryCard } from "@/components/touchline/player/player-current-story-card";
import { PlayerPositionMapWidget } from "@/components/touchline/player/player-position-map-widget";
import { PlayerPositionProfileMount } from "../../shared/player-position-profile-mount";
import { ProfileRoleSummary } from "../shared/profile-role-summary";
import { player, positionOptions, optionalPositionOptions, effectivePositions, currentStory } from "./fixtures";

/**
 * Gate D W1 — D01, declared and evidence-derived positions diverge. See the sibling
 * `agreeing-positions/page.tsx` for the shared mount notes. `ProfileRoleSummary` (remediation,
 * 2026-11-24) demonstrates the approved 14-role profile experience with declared profile `CB`
 * diverging from the evidence-derived profile `RB` — the two differ at the profile level, not
 * only at the exact tactical-code level, and the summary explicitly states no automatic
 * primary-position mutation occurs.
 */
export default function D01DivergingPositionsPage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d01-overview-position-evidence" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D01
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D01 &middot; Declared and evidence-derived positions diverge
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        The position editor below is simulated: no Server Action is called, and no player record
        is written.
      </p>
      <div className="flex flex-col gap-4">
        <PlayerCurrentStoryCard story={currentStory} />
        <PlayerPositionMapWidget positions={effectivePositions} />
        <PlayerPositionProfileMount player={player} positionOptions={positionOptions} optionalPositionOptions={optionalPositionOptions} />
        <ProfileRoleSummary declaredTactical={player.primaryPosition as CanonicalTacticalPosition} effectivePositions={effectivePositions} />
      </div>
    </div>
  );
}
