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
 * P1-03/P1-04/P1-05: before this fix, squad readiness and carry-forward could render twice —
 * once inline in the quiet-day composition and again, unconditionally, in the context rail. A
 * first attempt at fixing that (P1-03) over-corrected into two NEW defects a later independent
 * review caught:
 *
 * - **P1-04**: that fix suppressed the context rail's organisation-wide squad availability
 *   (`TodaySquadStatus`, from `getOrgActivePlayerAvailability()`) whenever ANY Matchday anchor
 *   existed — wrongly treating it as the same fact as Matchday's own match-specific readiness
 *   (who's selected for THIS match). They are different scopes that can both be true at once;
 *   suppressing the org-wide fact lost real information. The corrected rule: the rail omits it
 *   only when the quiet-day hero is already showing the identical org-wide fact inline (no
 *   Matchday anchor) — whenever a Matchday anchor exists, the rail keeps showing it, now with a
 *   scope label ("All active players") since Matchday's own card is also on the page.
 * - **P1-05**: that fix suppressed the context rail's ENTIRE carry-forward collection whenever
 *   the day was quiet, instead of just the one item the quiet-day hero already features inline
 *   — silently dropping the 2nd/3rd carry-forward item from the page. The corrected rule: the
 *   rail owns whatever the quiet-day hero does NOT feature (`.slice(1)`), never the whole
 *   collection.
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

// Deliberately different from the org-wide sample below — identical counts could mask an
// ownership error (the brief's own explicit instruction for these tests).
const sampleSquadStatus: TodaySquadStatus = { available: 9, doubtful: 1, unavailable: 0, notAvailable: [] };

function matchdayContextWithSelectedAvailability(): TodayMatchdayContext {
  const readiness: TodayMatchdayReadiness = {
    selection: { state: "READY", selectedCount: 11, targetCount: 11 },
    selectedAvailability: {
      selectedCount: 11,
      availableCount: 10,
      doubtfulCount: 1,
      unavailableCount: 0,
      unknownCount: 0,
      affectedPlayers: [{ playerId: "player-jonas", displayName: "Jonas", state: "DOUBTFUL" }],
    },
    lineup: { state: "READY" },
    tactics: { state: "UNKNOWN" },
    plannedRotations: { count: 2 },
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

const carryForwardItem1: TodayCarryForwardItem = { id: "carry-1", label: "Report still open — Blå 3-1 Åsgård", href: "/matches/past-1" };
const carryForwardItem2: TodayCarryForwardItem = { id: "carry-2", label: "Noah's development review is ready", href: "/players/noah" };
const carryForwardItem3: TodayCarryForwardItem = { id: "carry-3", label: "Team focus review is ready", href: "/team-focus" };

const sampleCarryForwardItems: TodayCarryForwardItem[] = [carryForwardItem1];

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

describe("TodaySurface — P1-04: organisation-wide squad availability is preserved, not hidden, on Matchday", () => {
  it("quiet day, no Matchday: org-wide availability appears once, inline, with no scope label needed (no ambiguity)", () => {
    renderSurface({ decisions: [], squadStatus: sampleSquadStatus, carryForwardItems: sampleCarryForwardItems });
    expect(screen.getAllByText("Available").length).toBe(1);
    expect(screen.queryByText("All active players")).not.toBeInTheDocument();
  });

  it("quiet day, with Matchday: org-wide availability remains visible (moved to the rail, with a scope label) alongside Matchday's own distinct match-specific readiness", () => {
    renderSurface({
      decisions: [],
      matchdayContext: matchdayContextWithSelectedAvailability(),
      squadStatus: sampleSquadStatus,
      carryForwardItems: sampleCarryForwardItems,
    });
    // Org-wide (9 available) and match-specific (10 available · 1 doubtful) are deliberately
    // different numbers — this fails if either value leaks into, or masks, the other.
    expect(screen.getAllByText("Available").length).toBe(1);
    expect(screen.getByText("All active players")).toBeInTheDocument();
    expect(screen.getByText("11 of 11 planned")).toBeInTheDocument();
    expect(screen.getByText("10 available · 1 doubtful")).toBeInTheDocument();
  });

  it("decision day, no Matchday: org-wide availability remains the rail's sole content, with no scope label needed (no ambiguity)", () => {
    renderSurface({ decisions: [coachDecision()], squadStatus: sampleSquadStatus, carryForwardItems: sampleCarryForwardItems });
    expect(screen.getAllByText("Available").length).toBe(1);
    expect(screen.queryByText("All active players")).not.toBeInTheDocument();
  });

  it("decision day, with Matchday: org-wide availability remains visible in the rail, distinct from Matchday's own match-specific readiness", () => {
    renderSurface({
      decisions: [coachDecision()],
      matchdayContext: matchdayContextWithSelectedAvailability(),
      squadStatus: sampleSquadStatus,
      carryForwardItems: sampleCarryForwardItems,
    });
    expect(screen.getAllByText("Available").length).toBe(1);
    expect(screen.getByText("All active players")).toBeInTheDocument();
    expect(screen.getByText("10 available · 1 doubtful")).toBeInTheDocument();
  });

  it("does not fabricate an empty availability widget when the canonical org-wide result is absent", () => {
    renderSurface({ decisions: [], matchdayContext: matchdayContextWithSelectedAvailability(), squadStatus: null });
    expect(screen.queryByText("Available")).not.toBeInTheDocument();
    expect(screen.queryByText("All active players")).not.toBeInTheDocument();
  });

  it("Live Now/Matchday exclusivity is unaffected by the org-wide availability fix", () => {
    render(
      <OrgSlugProvider orgSlug="acme">
        <TodaySurface
          commandCentre={baseCommandCentre({ todayMatches: [] })}
          selectionDecisions={[]}
          applyRecommendation={vi.fn()}
          carryForwardItems={[]}
          squadStatus={sampleSquadStatus}
          liveNow={{
            primary: {
              matchId: "match-live-1",
              sessionId: "session-1",
              teamName: "Blå",
              opponentName: "Stoppen Juventus",
              goalsFor: 1,
              goalsAgainst: 0,
              periodLabel: "1st half",
              elapsedLabel: "12:00",
              isRunning: true,
              primaryAction: { kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" },
              startsAtIso: "2026-09-15T16:00:00.000Z",
              kind: "LEAGUE",
              eventId: null,
            },
            otherLiveCount: 0,
          }}
          matchdayContext={matchdayContextWithSelectedAvailability()}
        />
      </OrgSlugProvider>,
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText("Matchday")).not.toBeInTheDocument();
    // Org-wide availability still appears exactly once even though Live Now, not Matchday, owns
    // the anchor.
    expect(screen.getAllByText("Available").length).toBe(1);
  });
});

describe("TodaySurface — P1-05: carry-forward items beyond the first are preserved, not discarded", () => {
  it("zero items: neither the quiet-day hero nor the rail renders a carry-forward widget", () => {
    renderSurface({ decisions: [], carryForwardItems: [] });
    expect(screen.queryByText(/Report still open/)).not.toBeInTheDocument();
    expect(screen.queryByText(/development review is ready/)).not.toBeInTheDocument();
  });

  it("one item, quiet, no Matchday: the single item appears exactly once (featured inline)", () => {
    renderSurface({ decisions: [], carryForwardItems: [carryForwardItem1] });
    expect(screen.getAllByText(carryForwardItem1.label).length).toBe(1);
  });

  it("two items, quiet, no Matchday: both items appear, each exactly once — the second is not discarded", () => {
    renderSurface({ decisions: [], carryForwardItems: [carryForwardItem1, carryForwardItem2] });
    expect(screen.getAllByText(carryForwardItem1.label).length).toBe(1);
    expect(screen.getAllByText(carryForwardItem2.label).length).toBe(1);
  });

  it("three items, quiet, no Matchday: all three appear, each exactly once — none duplicated, none dropped", () => {
    renderSurface({ decisions: [], carryForwardItems: [carryForwardItem1, carryForwardItem2, carryForwardItem3] });
    for (const item of [carryForwardItem1, carryForwardItem2, carryForwardItem3]) {
      expect(screen.getAllByText(item.label).length).toBe(1);
    }
  });

  it("three items, quiet, WITH Matchday: all three still appear, each exactly once", () => {
    renderSurface({
      decisions: [],
      matchdayContext: matchdayContextWithMissingLineup(),
      carryForwardItems: [carryForwardItem1, carryForwardItem2, carryForwardItem3],
    });
    for (const item of [carryForwardItem1, carryForwardItem2, carryForwardItem3]) {
      expect(screen.getAllByText(item.label).length).toBe(1);
    }
  });

  it("three items, decision composition: the quiet-day inline slot never applies — all three remain contextual, each exactly once", () => {
    renderSurface({
      decisions: [coachDecision()],
      carryForwardItems: [carryForwardItem1, carryForwardItem2, carryForwardItem3],
    });
    for (const item of [carryForwardItem1, carryForwardItem2, carryForwardItem3]) {
      expect(screen.getAllByText(item.label).length).toBe(1);
    }
  });

  it("three items, decision composition, WITH Matchday: all three remain contextual, each exactly once", () => {
    renderSurface({
      decisions: [coachDecision()],
      matchdayContext: matchdayContextWithMissingLineup(),
      carryForwardItems: [carryForwardItem1, carryForwardItem2, carryForwardItem3],
    });
    for (const item of [carryForwardItem1, carryForwardItem2, carryForwardItem3]) {
      expect(screen.getAllByText(item.label).length).toBe(1);
    }
  });
});
