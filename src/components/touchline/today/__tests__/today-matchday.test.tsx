import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayMatchday } from "../today-matchday";
import type { TodayFootballMatch } from "@/lib/touchline/presentation/today-football-match";
import type { TodayMatchdayReadiness } from "@/lib/touchline/presentation/today-matchday-readiness";
import type { TodayMatchdayAction } from "@/lib/touchline/presentation/today-matchday-readiness";

// Issue #853 regression: `TodayMatchday` is a second, pre-existing lifecycle→label surface (it
// does not go through `buildMatchPresentation()`/`matchPresentationPhase()`) that reproduced the
// exact same defect — it unconditionally rendered "FT" for `POST_MATCH` (which also covers
// `played` and `report_incomplete`, not just `done`). Fixed narrowly in place, same canonical
// "Played"/"Report incomplete"/"FT" vocabulary, no new lifecycle engine introduced.

const NOW_ISO = "2027-03-13T14:00:00.000Z";

function makeMatch(overrides: Partial<TodayFootballMatch> & Pick<TodayFootballMatch, "id">): TodayFootballMatch {
  return {
    source: "LEAGUE",
    containerId: "round-1",
    containerLabel: "Round 34",
    teamOrSquadName: "Rød",
    opponentName: "Graabein United",
    startsAt: "2027-03-13T12:40:00.000Z",
    venueLabel: "Home",
    lifecycleStatus: "planning_open",
    hasActiveLiveSession: false,
    reportState: null,
    score: null,
    href: "/matches/x",
    liveEntryHref: "/matches/x/live",
    ...overrides,
  };
}

const READINESS: TodayMatchdayReadiness = {
  selection: { state: "FINALIZED", selectedCount: 11, targetCount: 11 },
  selectedAvailability: null,
  lineup: { state: "READY" },
  tactics: { state: "READY" },
  plannedRotations: null,
  blockingSignals: [],
  decisionSignals: [],
};

const ACTION: TodayMatchdayAction = {
  kind: "REVIEW_MATCH",
  title: "Review match",
  detail: null,
  actionLabel: "Review",
  actionHref: "/matches/x",
  consumedSignalId: null,
};

describe("TodayMatchday", () => {
  it("never shows FT for a played match (kicked off, no report at all)", () => {
    const match = makeMatch({ id: "m1", lifecycleStatus: "played", score: null });
    render(<TodayMatchday match={match} readiness={READINESS} action={ACTION} nowIso={NOW_ISO} />);
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Played/)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("never shows FT for a report_incomplete match, even though its draft score stays visible", () => {
    const match = makeMatch({
      id: "m1",
      lifecycleStatus: "report_incomplete",
      score: { own: 2, opponent: 0 },
    });
    render(<TodayMatchday match={match} readiness={READINESS} action={ACTION} nowIso={NOW_ISO} />);
    expect(screen.queryByText(/^FT/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Report incomplete/)).toBeInTheDocument();
    expect(screen.getByText("2–0")).toBeInTheDocument();
  });

  it("shows FT and the real score for a done match", () => {
    const match = makeMatch({
      id: "m1",
      lifecycleStatus: "done",
      score: { own: 2, opponent: 0 },
    });
    render(<TodayMatchday match={match} readiness={READINESS} action={ACTION} nowIso={NOW_ISO} />);
    expect(screen.getByText(/^FT/)).toBeInTheDocument();
    expect(screen.getByText("2–0")).toBeInTheDocument();
    expect(screen.getByText(/Report complete/)).toBeInTheDocument();
  });
});
