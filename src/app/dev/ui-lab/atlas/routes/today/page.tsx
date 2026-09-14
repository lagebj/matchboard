"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UiLabShell } from "../../../ui-lab-shells";
import { atlasNav } from "../../fixtures";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { AssistantCommandCentrePage } from "@/components/assistant/assistant-command-centre-page";
import { TabRail, type TabItem } from "@/components/ui/tab-rail";
import { buildTodayFixture, TODAY_FIXTURE_STATES, type TodayFixtureStateKey } from "./today-operational-fixtures";

const TABS: TabItem<TodayFixtureStateKey>[] = TODAY_FIXTURE_STATES.map(({ key, label }) => ({
  key,
  label,
  href: `?state=${key}`,
}));

function isFixtureState(value: string | null): value is TodayFixtureStateKey {
  return value !== null && TODAY_FIXTURE_STATES.some((s) => s.key === value);
}

function AtlasTodayPageInner() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get("state");
  const activeState: TodayFixtureStateKey = isFixtureState(stateParam) ? stateParam : "primary";
  const fixture = buildTodayFixture(activeState);

  return (
    <UiLabShell activeKey="today" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <div className="mb-4">
        <TabRail items={TABS} activeKey={activeState} ariaLabel="Today fixture state" />
      </div>
      <OrgSlugProvider orgSlug="uilab-demo-org">
        <AssistantCommandCentrePage
          commandCentre={fixture.commandCentre}
          projection={fixture.projection}
          recentMatches={fixture.recentMatches}
          squadStatus={fixture.squadStatus}
          liveNow={fixture.liveNow}
          selectionDecisions={fixture.selectionDecisions}
          applyRecommendation={fixture.applyRecommendation}
          sinceLastVisitScope={fixture.sinceLastVisitScope}
          sinceLastVisitFacts={fixture.sinceLastVisitFacts}
        />
      </OrgSlugProvider>
    </UiLabShell>
  );
}

/**
 * Today — ADR-0141 Today Operational Command Surface, replacing the earlier Atlas Today fixture
 * (which rendered widgets no longer used by the production route). This composition renders the
 * real production `AssistantCommandCentrePage` against representative in-memory data, matching
 * `05_IMPLEMENTATION_PLAN.md` §"UI Lab": `primary` (golden — live match, coordinated decisions,
 * since-last-visit, carry-forward report, recent football), `planning` (no live match, concrete
 * Next Action), `ready` (no immediate action), `coordination` (second decision waits on the
 * first). State is UI-Lab-only and URL-backed (`?state=...`) — the production route has no
 * equivalent query parameter.
 */
export default function AtlasTodayPage() {
  return (
    <Suspense fallback={<div className="touchline p-6 text-sm text-[var(--text-muted)]">Loading…</div>}>
      <AtlasTodayPageInner />
    </Suspense>
  );
}
