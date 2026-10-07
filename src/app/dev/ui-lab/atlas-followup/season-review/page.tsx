import Link from "next/link";
import { AppearanceControl, TouchlinePageHeader } from "@/components/touchline";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { SeasonReviewOverview } from "@/app/(app)/o/[orgSlug]/season/season-review-overview";
import { seasonReviewFixture } from "./fixtures";

/**
 * ADR-0157 C9 golden-state fixture — Season Review, desktop
 * (`15_TEST_AND_ACCEPTANCE_MATRIX.md` golden state 7). Renders the real production C7 Overview
 * tab (`SeasonReviewOverview`) against deterministic stories built through the real
 * `buildSeasonReviewViewModel()` — story-first, matrix as drill-down only. The Teams/Players/
 * Development/Opportunity tabs are the production route's own live surfaces, linked by each
 * story's "Explore evidence" affordance; they need a league season's real data and are not
 * duplicated as static fixtures.
 */
const TABS: TabItem<string>[] = [
  { key: "overview", label: "Overview" },
  { key: "teams", label: "Teams" },
  { key: "players", label: "Players" },
  { key: "development", label: "Development" },
  { key: "opportunity", label: "Opportunity" },
];

export default function SeasonReviewFixturePage() {
  return (
    <div className="touchline mx-auto flex max-w-[960px] flex-col gap-5 px-4 py-6 medium:max-w-[1180px]">
      <Link href="/dev/ui-lab/atlas-followup" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Atlas Follow-up
      </Link>
      <AppearanceControl />

      <TouchlinePageHeader
        title="Season Review"
        context={`${seasonReviewFixture.leagueSeasonName} — what are we learning across this season, and where should we look deeper?`}
      />

      <TabRail items={TABS} activeKey="overview" ariaLabel="Season Review fixture tabs" />

      <SeasonReviewOverview stories={seasonReviewFixture.viewModel.stories} />
    </div>
  );
}