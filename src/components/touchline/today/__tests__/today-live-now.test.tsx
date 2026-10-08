import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayLiveNow } from "../today-live-now";
import type { TodayLiveMatchSummary } from "@/lib/live-match/get-today-live-match-summaries";

/**
 * ADR-0152 §2/§11 — Today's "Live Now" card must consume the same canonical resolver every
 * other Live Reporting surface does, not independently infer its own CTA. This card previously
 * had exactly one hardcoded "Follow live" CTA regardless of lifecycle state; it now also shows a
 * resolver-driven primary action into the editable Live Reporting page.
 */

function summary(overrides: Partial<TodayLiveMatchSummary>): TodayLiveMatchSummary {
  return {
    matchId: "match-1",
    sessionId: "session-1",
    teamName: "Home",
    opponentName: "Away",
    goalsFor: 1,
    goalsAgainst: 0,
    periodLabel: "First half",
    elapsedLabel: "12:00",
    isRunning: true,
    primaryAction: { kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" },
    startsAtIso: "2026-10-08T16:00:00.000Z",
    kind: "LEAGUE",
    eventId: null,
    ...overrides,
  };
}

function renderCard(primary: TodayLiveMatchSummary | null, otherLiveCount = 0) {
  render(
    <TodayLiveNow
      primary={primary}
      otherLiveCount={otherLiveCount}
      matchHref={(matchId) => `/matches/${matchId}/live/follow`}
      reportHref={(matchId) => `/matches/${matchId}/live`}
    />,
  );
}

describe("TodayLiveNow", () => {
  it("renders nothing when there is no live match", () => {
    renderCard(null);
    expect(screen.queryByText(/live/i)).not.toBeInTheDocument();
  });

  it("shows 'Continue live reporting' (into the editable page) while a period is running, alongside Follow live", () => {
    renderCard(summary({ primaryAction: { kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" } }));
    const primaryCta = screen.getByRole("link", { name: "Continue live reporting" });
    expect(primaryCta).toHaveAttribute("href", "/matches/match-1/live");
    const followCta = screen.getByRole("link", { name: "Follow live" });
    expect(followCta).toHaveAttribute("href", "/matches/match-1/live/follow");
  });

  it("shows 'Start <period>' between periods, matching the resolver's own label", () => {
    renderCard(summary({ isRunning: false, primaryAction: { kind: "START_PERIOD", period: "SECOND_HALF", label: "Start second half" } }));
    expect(screen.getByRole("link", { name: "Start second half" })).toBeInTheDocument();
  });

  it("shows 'Resume <period>' for a paused period", () => {
    renderCard(summary({ isRunning: false, primaryAction: { kind: "RESUME_PERIOD", period: "SECOND_HALF", label: "Resume second half" } }));
    expect(screen.getByRole("link", { name: "Resume second half" })).toBeInTheDocument();
  });

  it("shows 'Finish live reporting' once the final period has ended", () => {
    renderCard(summary({ isRunning: false, periodLabel: "Full time", primaryAction: { kind: "FINISH_LIVE_REPORTING" } }));
    expect(screen.getByRole("link", { name: "Finish live reporting" })).toBeInTheDocument();
  });

  it("shows the paused indicator only when the clock is not running", () => {
    renderCard(summary({ isRunning: false }));
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it("shows the other-live count when more than one match is live", () => {
    renderCard(summary({}), 2);
    expect(screen.getByText("+2 live")).toBeInTheDocument();
  });
});
