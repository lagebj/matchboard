import { EvidenceStory } from "@/components/touchline/evidence/evidence-story";
import { Sparkline } from "@/components/touchline/viz/sparkline";
import { StackedDistribution } from "@/components/touchline/viz/stacked-distribution";
import { buildPlayerEvidenceViewModel, type PlayerEvidenceStoryData } from "@/lib/touchline/presentation/player-evidence-view-model";
import { ConsolidatedPositionEvidence } from "./consolidated-position-evidence";
import type { ExactPositionShare } from "./position-profile-consolidation";

/**
 * Gate D register D02 — reproduces the Evidence tab's own grouped-rendering block
 * (`src/app/(app)/o/[orgSlug]/players/[playerId]/page.tsx`'s `EvidenceTab`, lines ~496-534)
 * exactly, over fixture `PlayerEvidenceStoryData[]` input instead of a DB-backed one. Uses the
 * real `buildPlayerEvidenceViewModel` (a pure function, no DB access) — not a reimplementation.
 *
 * Remediation (2026-11-24): the POSITION group's visual is now `ConsolidatedPositionEvidence`
 * (profile-level consolidation + exact drill-down), not a bare `StackedDistribution` over exact
 * codes — the exact-only version did not demonstrate D02's actual "profile-level consolidation"
 * acceptance question. MATCH_CONTEXT keeps the plain `StackedDistribution` — its segments
 * (CORE/SUPPORT/DEVELOPMENT) are not tactical position codes, so no profile collapsing applies.
 */
export function EvidenceGroups({ stories }: { stories: PlayerEvidenceStoryData[] }) {
  const vm = buildPlayerEvidenceViewModel({ stories });

  return (
    <div className="flex flex-col gap-4">
      {(["OPPORTUNITY", "POSITION", "MATCH_CONTEXT", "TREND"] as const).map((group) => {
        const groupStories = vm.storiesByGroup[group];
        if (groupStories.length === 0) return null;
        const groupLabel =
          group === "OPPORTUNITY" ? "Opportunity" : group === "POSITION" ? "Position" : group === "TREND" ? "Trends" : "Match context";
        return (
          <div key={group} className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{groupLabel}</p>
            {groupStories.map((s) => (
              <EvidenceStory
                key={s.id}
                question={s.question}
                label={groupLabel}
                title={s.title}
                value={s.value}
                valueCaption={s.valueCaption}
                sample={s.sample}
                confidence={s.confidence}
                interpretation={s.interpretation}
                detailHref={s.detailHref}
                visual={
                  s.sparkline ? (
                    <Sparkline question={s.question} values={s.sparkline} periodLabels={s.sparklineLabels ?? []} />
                  ) : s.positionShares && group === "POSITION" ? (
                    <ConsolidatedPositionEvidence question={s.question} exactShares={s.positionShares as ExactPositionShare[]} />
                  ) : s.positionShares ? (
                    <StackedDistribution
                      question={s.question}
                      segments={s.positionShares.map((p) => ({ label: p.code, value: p.sharePercent }))}
                    />
                  ) : undefined
                }
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
