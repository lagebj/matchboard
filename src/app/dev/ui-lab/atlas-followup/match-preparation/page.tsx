import Link from "next/link";
import { AppearanceControl, TouchlinePageHeader } from "@/components/touchline";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricStrip } from "@/components/touchline/widget/metric-strip";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MatchPreparationWidget } from "@/components/matches/match-detail/match-preparation-widget";
import { MatchOpponentMemory } from "@/components/matches/match-detail/match-opponent-memory";
import { formatGameFormat, formatMatchType, formatVenue } from "@/lib/matches/match-detail-format";
import { matchPrepFixture } from "./fixtures";

/**
 * ADR-0157 C9 golden-state fixture — Match Preparation, mobile
 * (`15_TEST_AND_ACCEPTANCE_MATRIX.md` golden state 3). Renders the real production C3 panels
 * (`MatchIdentityCard`, `MatchPreparationWidget`, `MatchOpponentMemory` — the latter built
 * through the real `buildOpponentMemoryViewModel()`) in the ADR-0157 §6 information order:
 * identity → opponent memory → current plan. The ranked Match Insights and the pitch/lineup
 * (`MatchTacticsPanel`) self-fetch from a live match via server actions and are intentionally
 * not static-fixtured — the same documented exclusion the Round Board fixture makes for its
 * drag/drop mutations.
 */
export default function MatchPreparationFixturePage() {
  const f = matchPrepFixture;

  const factsItems = [
    { id: "format", label: "Format", value: formatGameFormat(f.gameFormat) },
    { id: "venue", label: "Venue", value: formatVenue(f.venue) },
    { id: "type", label: "Type", value: formatMatchType(f.matchType) },
  ];

  return (
    <div className="touchline mx-auto flex max-w-[440px] flex-col gap-5 px-4 py-6 medium:max-w-[720px]">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <AppearanceControl />

      <TouchlinePageHeader
        title={`${f.teamName} vs ${f.presentation.awayTeam}`}
        context="Match preparation — opponent memory, ranked insights, and the current plan."
      />

      <div className="flex items-center justify-center rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6">
        <MatchIdentityCard presentation={f.presentation} ownKitColor={f.ownKitColor} />
      </div>

      <MetricStrip items={factsItems} />

      <MatchPreparationWidget input={f.preparationInput} />

      <MatchOpponentMemory opponentMemory={f.opponentMemory} opponentTabHref="?tab=opponent-context" />

      <Surface padding="md">
        <SectionHeader
          title="Ranked insights and current plan"
          description="Rendered by the live surface only."
        />
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">
          Match Insights and the pitch/lineup self-fetch from the live match — see the real match
          page. This fixture covers the deterministic preparation hierarchy above.
        </p>
      </Surface>
    </div>
  );
}