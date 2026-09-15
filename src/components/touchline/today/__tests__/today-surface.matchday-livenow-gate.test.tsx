import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// `DueDecisionReviewSection` transitively imports a "use server" actions module that pulls in
// next-auth, which fails to resolve against this repo's installed Next.js version under vitest's
// jsdom component config (a pre-existing test-infra gap, unrelated to this test's subject) — mock
// it out since `reviews` is always empty in this test's fixtures anyway.
vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { TodaySurface } = await import("@/components/touchline/today/today-surface");
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";

// Regression test for the production incident where `getTodayLiveMatchSummaries()` always
// resolves to a defined `{ primary: null, otherLiveCount: 0 }` object (never `null`/`undefined`)
// when there is no live match — the `liveNow ? <TodayLiveNow /> : (matchdayContext && ... )`
// ternary in `today-surface.tsx` therefore always picked the `<TodayLiveNow />` branch (which
// itself renders nothing when `primary` is null), permanently starving `<TodayMatchday />` even
// though a real same-day match/readiness/action existed. Fixed by gating on `liveNow?.primary`
// instead of `liveNow` itself. UI-Lab's fixtures never caught this because they hand-authored
// `liveNow: undefined` directly rather than the loader's real always-defined shape.

function baseCommandCentre(): AssistantCommandCentre {
  return {
    leagueSeasonId: null,
    leagueSeasonName: null,
    items: [],
    todayMatches: [],
    dueDecisionReviews: [],
    roundPlanIntegrities: {},
    activeLiveSessions: {},
    computedAt: new Date("2026-09-15T12:00:00.000Z"),
  };
}

function noLiveMatch(): TodayLiveNowResult {
  return { primary: null, otherLiveCount: 0 };
}

function featuredMatchdayContext(): TodayMatchdayContext {
  return {
    featured: {
      id: "match-1",
      source: "LEAGUE",
      containerId: "round-1",
      containerLabel: "Round 1",
      teamOrSquadName: "Blå",
      opponentName: "Stoppen Juventus",
      startsAt: "2026-09-15T16:00:00.000Z",
      venueLabel: "Home",
      lifecycleStatus: "planning_open",
      hasActiveLiveSession: false,
      reportState: null,
      score: null,
      href: "/matches/match-1",
      liveEntryHref: "/matches/match-1/live",
    },
    readiness: {
      selection: { state: "DRAFT", selectedCount: 11, targetCount: 11 },
      selectedAvailability: null,
      lineup: { state: "MISSING" },
      tactics: { state: "UNKNOWN" },
      plannedRotations: null,
      blockingSignals: [],
      decisionSignals: [],
    },
  };
}

function renderSurface(props: { liveNow?: TodayLiveNowResult; matchdayContext?: TodayMatchdayContext }) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <TodaySurface
        commandCentre={baseCommandCentre()}
        selectionDecisions={[]}
        applyRecommendation={vi.fn()}
        carryForwardItems={[]}
        liveNow={props.liveNow}
        matchdayContext={props.matchdayContext}
      />
    </OrgSlugProvider>,
  );
}

describe("TodaySurface Live Now / Matchday gating", () => {
  it("renders TodayMatchday when liveNow resolves to the always-defined no-live-match shape", () => {
    renderSurface({ liveNow: noLiveMatch(), matchdayContext: featuredMatchdayContext() });

    expect(screen.getByText(/Stoppen Juventus/)).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("still renders nothing in that slot when there is no featured Matchday match either", () => {
    renderSurface({ liveNow: noLiveMatch(), matchdayContext: undefined });

    expect(screen.queryByText(/Stoppen Juventus/)).not.toBeInTheDocument();
  });

  it("prefers TodayLiveNow when a match is actually live", () => {
    renderSurface({
      liveNow: {
        primary: {
          matchId: "match-1",
          sessionId: "session-1",
          teamName: "Blå",
          opponentName: "Stoppen Juventus",
          goalsFor: 1,
          goalsAgainst: 0,
          periodLabel: "1st half",
          elapsedLabel: "12:00",
          isRunning: true,
        },
        otherLiveCount: 0,
      },
      matchdayContext: featuredMatchdayContext(),
    });

    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
