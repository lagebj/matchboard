import { StackedDistribution } from "@/components/touchline/viz/stacked-distribution";
import { consolidateExactSharesByProfile, type ExactPositionShare } from "./position-profile-consolidation";

/**
 * Directional UI Lab presentation for D02's actual acceptance question — "profile-level dot
 * consolidation without losing exact sided drill-down or double-counting." Uses the real
 * `StackedDistribution` component at both levels (no new viz primitive); the consolidation math
 * itself (`consolidateExactSharesByProfile`) is real and reuses Gate A's `collapseTacticalToProfile`.
 *
 * Data-truth disclosure (see `DATA_TRUTH_AND_FIXTURES.md`): `PlayerEvidenceStoryData.positionShares`
 * is a real, type-level rendering slot already wired to a real production component
 * (`StackedDistribution`, rendered by the real Evidence tab's `EvidenceTab` in
 * `src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx` when present) — but the real production
 * data source, `buildEvidenceStories()`
 * (`src/lib/touchline/presentation/player-detail-production-adapter.ts`), never actually
 * populates it; its real POSITION story shows only a single top-position headline, no share
 * breakdown. This candidate exercises the real rendering path with synthetic share data to
 * demonstrate the required two-level presentation — it does not reproduce an existing populated
 * production example, because none currently exists. It is NOT a claim that production's
 * aggregation algorithm (there isn't one yet) has been verified correct.
 */
export function ConsolidatedPositionEvidence({ question, exactShares }: { question: string; exactShares: ExactPositionShare[] }) {
  const profileShares = consolidateExactSharesByProfile(exactShares);

  return (
    <div className="flex flex-col gap-2">
      <StackedDistribution question={question} segments={profileShares.map((p) => ({ label: p.code, value: p.sharePercent }))} />
      <details className="text-[12px] text-[var(--text-muted)]">
        <summary className="cursor-pointer select-none">Exact tactical breakdown</summary>
        <div className="mt-2">
          <StackedDistribution question={`${question} (exact)`} segments={exactShares.map((s) => ({ label: s.code, value: s.sharePercent }))} />
        </div>
      </details>
      <p className="text-[11px] text-[var(--text-muted)]">
        Directional presentation: the profile-level summary above and the exact breakdown below are
        both computed from the same underlying shares via the real 14-role mapping
        (`collapseTacticalToProfile`) — nothing is double-counted, nothing is dropped.
      </p>
    </div>
  );
}
