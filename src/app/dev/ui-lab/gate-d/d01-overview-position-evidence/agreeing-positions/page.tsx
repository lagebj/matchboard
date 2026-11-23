import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { PlayerCurrentStoryCard } from "@/components/touchline/player/player-current-story-card";
import { PlayerPositionMapWidget } from "@/components/touchline/player/player-position-map-widget";
import { PlayerPositionProfileMount } from "../../shared/player-position-profile-mount";
import { player, positionOptions, optionalPositionOptions, effectivePositions, currentStory } from "./fixtures";

/**
 * Gate D W1 — D01, declared and evidence-derived positions agree. Mounts the real, unmodified
 * `PlayerCurrentStoryCard`, `PlayerPositionMapWidget`, and `PlayerPositionProfile` (via a
 * fixture-safe mount, see `../../shared/player-position-profile-mount.tsx`). See
 * `docs/ui-lab/gate-d-w1-candidates/VISUAL_VS_CURRENT.md` for the disclosed mismatch between this
 * scenario's official acceptance question (a "14-role profile vocabulary" distinct from the
 * 24-sided tactical vocabulary) and the current accepted architecture (ADR-0154: one unified
 * 24-code vocabulary for declaration, tactical slots, and evidence).
 */
export default function D01AgreeingPositionsPage() {
  return (
    <div className="touchline mx-auto max-w-[520px] px-4 py-8" data-ui-lab-ready="true">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/dev/ui-lab/gate-d/d01-overview-position-evidence" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; D01
        </Link>
        <AppearanceControl />
      </div>
      <h1 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        D01 &middot; Declared and evidence-derived positions agree
      </h1>
      <p className="mb-4 text-[12px] text-[var(--text-muted)]">
        The position editor below is simulated: no Server Action is called, and no player record
        is written.
      </p>
      <div className="flex flex-col gap-4">
        <PlayerCurrentStoryCard story={currentStory} />
        <PlayerPositionMapWidget positions={effectivePositions} />
        <PlayerPositionProfileMount player={player} positionOptions={positionOptions} optionalPositionOptions={optionalPositionOptions} />
      </div>
    </div>
  );
}
