import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Same pre-existing test-infra gap documented against the production TodaySurface tests
// (today-surface.matchday-livenow-gate.test.tsx).
vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { TodaySurface } = await import("@/components/touchline/today/today-surface");
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import { gateCBaseCommandCentre, gateCBuildBusyDay } from "../../../shared/fixtures";

/**
 * Gate C W1 — Live Now/Matchday exclusivity, exercised against THIS wave's own fixture builder
 * (register §3 "Only one may own the top-level anchor at a time. Include transition and
 * regression coverage even if Live Now is not a separate W1 golden candidate."). Mirrors the
 * production regression this guards against
 * (today-surface.matchday-livenow-gate.test.tsx) with Gate C's own matchday fixture rather than
 * duplicating that test file.
 */
const busyDay = gateCBuildBusyDay({ source: "LEAGUE", phase: "IMMINENT" });

function renderSurface(liveNow: TodayLiveNowResult) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <TodaySurface
        commandCentre={gateCBaseCommandCentre({ todayMatches: busyDay.todayMatches })}
        selectionDecisions={[]}
        applyRecommendation={vi.fn()}
        carryForwardItems={[]}
        liveNow={liveNow}
        matchdayContext={busyDay.matchdayContext}
        nowIso={busyDay.nowIso}
      />
    </OrgSlugProvider>,
  );
}

describe("Gate C W1 — C03 Live Now / Matchday exclusivity", () => {
  it("renders Matchday, not Live Now, when nothing is actually live", () => {
    renderSurface({ primary: null, otherLiveCount: 0 });
    expect(screen.getByText("Matchday")).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("renders Live Now instead of Matchday once the same match is actually live — never both", () => {
    renderSurface({
      primary: {
        matchId: busyDay.matchdayContext!.featured.id,
        sessionId: "session-c03-1",
        teamName: "Blå",
        opponentName: "Stoppen Juventus",
        goalsFor: 0,
        goalsAgainst: 0,
        periodLabel: "1st half",
        elapsedLabel: "5:00",
        isRunning: true,
        primaryAction: { kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" },
        startsAtIso: busyDay.nowIso,
        kind: "LEAGUE",
        eventId: null,
      },
      otherLiveCount: 0,
    });
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText("Matchday")).not.toBeInTheDocument();
  });
});
