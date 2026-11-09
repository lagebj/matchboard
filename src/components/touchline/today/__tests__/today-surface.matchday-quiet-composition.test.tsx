import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Same pre-existing test-infra gap documented in today-surface.matchday-livenow-gate.test.tsx —
// DueDecisionReviewSection transitively imports a "use server" actions module that does not
// resolve under vitest's jsdom component config. `reviews` is empty in every fixture below.
vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { TodaySurface } = await import("@/components/touchline/today/today-surface");
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { CoachDecision } from "@/lib/situational/situation-types";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";
import type { TodayMatchdayReadiness } from "@/lib/touchline/presentation/today-matchday-readiness";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";

/**
 * P1-01/P1-02/P1-03 remediation regression tests (PR #826 independent review).
 *
 * P1-01/P1-02: before this fix, `TodaySurface` could render a same-day Matchday action (e.g.
 * "Prepare lineup") alongside an unconditional "Nothing needs your attention" quiet-day hero
 * directly below it whenever there was no situational decision or due review — contradictory
 * statements on the same screen. The fix makes the quiet-day hero conditional on there being no
 * active Matchday anchor, and makes "Today in order" render whenever Matchday has a same-day
 * match to show, not only on decision days — without introducing a second relevance/ranking
 * system.
 *
 * P1-03: before this fix, squad readiness and carry-forward could render twice — once inline in
 * the quiet-day composition (or inline in Matchday's own card) and again, unconditionally, in
 * the context rail — on desktop (two columns) and on mobile (the same stacked reading order).
 * The fix gives each fact exactly one owner, computed from the same composition/Matchday facts
 * already resolved above, never a new ranking.
 */

function baseCommandCentre(overrides: Partial<AssistantCommandCentre> = {}): AssistantCommandCentre {
  return {
    leagueSeasonId: null,
    leagueSeasonName: null,
    items: [],
    todayMatches: [],
    dueDecisionReviews: [],
    roundPlanIntegrities: {},
    activeLiveSessions: {},
    computedAt: new Date("2026-09-15T12:00:00.000Z"),
    ...overrides,
  };
}

function coachDecision(overrides: Partial<CoachDecision> = {}): CoachDecision {
  return {
    id: "d1",
    candidateId: "c1",
    situation: "NEXT",
    horizon: "NEXT",
    visibility: "NORMAL",
    urgency: "NORMAL",
    interaction: "INFORM",
    title: "A decision needs attention",
    summary: "Something changed that needs a look.",
    alternatives: [],
    affectedEntities: [],
    reasonCodes: ["REQUIRES_REVIEW"],
    ...overrides,
  };
}

function matchdayContextWithMissingLineup(): TodayMatchdayContext {
  const readiness: TodayMatchdayReadiness = {
    selection: { state: "DRAFT", selectedCount: 8, targetCount: 11 },
    selectedAvailability: null,
    lineup: { state: "MISSING" },
    tactics: { state: "UNKNOWN" },
    plannedRotations: null,
    blockingSignals: [],
    decisionSignals: [],
  };
  return {
    featured: {
      id: "match-quiet-contradiction-1",
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
      href: "/matches/match-quiet-contradiction-1",
      liveEntryHref: "/matches/match-quiet-contradiction-1/live",
    },
    readiness,
  };
}

function renderSurface(props: {
  decisions?: CoachDecision[];
  matchdayContext?: TodayMatchdayContext;
  todayMatches?: AssistantCommandCentre["todayMatches"];
  squadStatus?: TodaySquadStatus | null;
  carryForwardItems?: TodayCarryForwardItem[];
}) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <TodaySurface
        commandCentre={baseCommandCentre({ todayMatches: props.todayMatches ?? [] })}
        projection={
          props.decisions
            ? {
                situation: { nowIso: "2026-09-15T12:00:00.000Z", primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
                decisions: props.decisions,
                deferredCount: 0,
                status: props.decisions.length > 0 ? "ACTION_REQUIRED" : "READY",
                policyRuntimeStatus: "HEALTHY",
              }
            : undefined
        }
        selectionDecisions={[]}
        applyRecommendation={vi.fn()}
        carryForwardItems={props.carryForwardItems ?? []}
        squadStatus={props.squadStatus}
        liveNow={{ primary: null, otherLiveCount: 0 }}
        matchdayContext={props.matchdayContext}
      />
    </OrgSlugProvider>,
  );
}

const sampleSquadStatus: TodaySquadStatus = { available: 9, doubtful: 1, unavailable: 0, notAvailable: [] };
const sampleCarryForwardItems: TodayCarryForwardItem[] = [
  { id: "carry-1", label: "Report still open — Blå 3-1 Åsgård", href: "/matches/past-1" },
];

describe("TodaySurface — Matchday/quiet-day composition (P1-01/P1-02 remediation)", () => {
  it("never shows the quiet-day 'Nothing needs your attention' hero alongside a genuine Matchday action", () => {
    renderSurface({ decisions: [], matchdayContext: matchdayContextWithMissingLineup() });
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prepare lineup" })).toBeInTheDocument();
  });

  it("still shows the calm quiet-day hero when there is genuinely no Matchday anchor", () => {
    renderSurface({ decisions: [] });
    expect(screen.getByText("Nothing needs your attention.")).toBeInTheDocument();
  });

  it("shows 'Today in order' alongside Matchday even with no situational decision (quiet composition)", () => {
    renderSurface({
      decisions: [],
      matchdayContext: matchdayContextWithMissingLineup(),
      todayMatches: [
        {
          matchId: "match-other-same-day-1",
          matchRoundId: "round-2",
          matchRoundName: "Round 2",
          teamName: "Vollen",
          opponent: "Åsgård",
          homeAway: "HOME",
          startsAt: "2026-09-15T18:00:00.000Z",
          squadStatus: "ready",
          hasActiveLiveSession: false,
          reportStatus: "none",
          homeScore: null,
          awayScore: null,
          lifecycleStatus: "planning_open",
        },
      ],
    });
    expect(screen.getByText("Today in order")).toBeInTheDocument();
    expect(screen.getByText(/Åsgård/)).toBeInTheDocument();
  });

  it("does not repeat the featured Matchday match as unresolved lower chronology", () => {
    renderSurface({
      decisions: [],
      matchdayContext: matchdayContextWithMissingLineup(),
      todayMatches: [
        {
          matchId: "match-quiet-contradiction-1",
          matchRoundId: "round-1",
          matchRoundName: "Round 1",
          teamName: "Blå",
          opponent: "Stoppen Juventus",
          homeAway: "HOME",
          startsAt: "2026-09-15T16:00:00.000Z",
          squadStatus: "draft",
          hasActiveLiveSession: false,
          reportStatus: "none",
          homeScore: null,
          awayScore: null,
          lifecycleStatus: "planning_open",
        },
      ],
    });
    // Matchday's own card still shows the opponent once; the lower "Today in order" list must
    // not add a second row for the exact same match.
    expect(screen.getAllByText(/Stoppen Juventus/).length).toBe(1);
  });

  it("keeps an unrelated genuine situational decision visible alongside Matchday (decision composition unchanged)", () => {
    renderSurface({
      decisions: [coachDecision()],
      matchdayContext: matchdayContextWithMissingLineup(),
    });
    expect(screen.getByText("A decision needs attention")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prepare lineup" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
  });

  it("never shows 'Today in order' on a genuinely quiet day with no Matchday anchor and no decision", () => {
    renderSurface({ decisions: [] });
    expect(screen.queryByText("Today in order")).not.toBeInTheDocument();
  });
});

describe("TodaySurface — context rail duplication (P1-03 remediation)", () => {
  it("quiet day, no Matchday: squad readiness and carry-forward each appear exactly once (not duplicated into the context rail)", () => {
    renderSurface({ decisions: [], squadStatus: sampleSquadStatus, carryForwardItems: sampleCarryForwardItems });
    expect(screen.getAllByText("Available").length).toBe(1);
    expect(screen.getAllByText(/Report still open/).length).toBe(1);
  });

  it("quiet day, with Matchday: squad readiness is not duplicated into the rail (Matchday's own card already shows readiness)", () => {
    renderSurface({
      decisions: [],
      matchdayContext: matchdayContextWithMissingLineup(),
      squadStatus: sampleSquadStatus,
      carryForwardItems: sampleCarryForwardItems,
    });
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Report still open/).length).toBe(1);
  });

  it("decision day, no Matchday: the context rail remains the sole owner of squad readiness and carry-forward", () => {
    renderSurface({
      decisions: [coachDecision()],
      squadStatus: sampleSquadStatus,
      carryForwardItems: sampleCarryForwardItems,
    });
    expect(screen.getAllByText("Available").length).toBe(1);
    expect(screen.getAllByText(/Report still open/).length).toBe(1);
  });

  it("decision day, with Matchday: the rail still shows carry-forward (decision composition never shows it inline) but not squad readiness (Matchday's own card already shows it)", () => {
    renderSurface({
      decisions: [coachDecision()],
      matchdayContext: matchdayContextWithMissingLineup(),
      squadStatus: sampleSquadStatus,
      carryForwardItems: sampleCarryForwardItems,
    });
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Report still open/).length).toBe(1);
  });
});
