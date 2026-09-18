import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BeforeMatchOverview } from "../before-match-overview";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";

// MatchNotesEditor (rendered inside the "Team notes" secondary-row tile) calls this "use server"
// action and `useRouter()` — mocked so the component test does not pull in next-auth/server
// import chains or require an app-router mount, matching the existing
// `absence-control.test.tsx` pattern for the same class of dependency.
vi.mock("@/app/(app)/matches/actions", () => ({
  updateMatchNotesAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const presentation = buildMatchPresentation({
  id: "m1",
  teamName: "Hvit",
  opponentName: "Huringen 1",
  isHome: true,
  kickoffAt: new Date("2026-09-23T18:00:00"),
  lifecycleStatus: "planning_open",
});

describe("BeforeMatchOverview (upcoming/planned)", () => {
  it("renders squad readiness, preparation checklist and a link into the Lineup tab", () => {
    render(
      <BeforeMatchOverview
        presentation={presentation}
        ownKitColor={null}
        preparationInput={{ squadSelectedCount: 12, squadTarget: 11, hasLineup: true, hasPlannedRotation: false }}
        venue="HOME"
        matchType="LEAGUE"
        gameFormat="SEVEN_A_SIDE"
        matchFit="UNKNOWN"
        lineupSummary={{ formationName: "GK + 2-3-1", filledCount: 7, totalSlots: 7 }}
        squadRows={[
          { playerId: "p1", playerName: "Emil", primaryPosition: "CM", secondaryPosition: null, absenceReason: null, lineupStatus: "STARTING" },
        ]}
        matchId="m1"
        notes={null}
        rotationChangeCount={0}
        opponentEncounterCount={1}
        opponentHasProfile={true}
        tabHref={(t) => `?tab=${t}`}
      />,
    );
    expect(screen.getByText("12/11")).toBeInTheDocument();
    expect(screen.getByText("Emil")).toBeInTheDocument();
    expect(screen.getByText("GK + 2-3-1")).toBeInTheDocument();
    expect(screen.getByText("Edit lineup")).toBeInTheDocument();
    expect(screen.getByText("1 previous encounter")).toBeInTheDocument();
  });

  it("never renders Player of the Match, MVP, or a rating concept", () => {
    render(
      <BeforeMatchOverview
        presentation={presentation}
        ownKitColor={null}
        preparationInput={{ squadSelectedCount: 0, squadTarget: 11, hasLineup: false, hasPlannedRotation: false }}
        venue="HOME"
        matchType="LEAGUE"
        gameFormat="SEVEN_A_SIDE"
        matchFit="UNKNOWN"
        lineupSummary={null}
        squadRows={[]}
        matchId="m1"
        notes={null}
        rotationChangeCount={0}
        opponentEncounterCount={0}
        opponentHasProfile={false}
        tabHref={(t) => `?tab=${t}`}
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/player of the match/i);
    expect(text).not.toMatch(/\bMVP\b/);
    expect(text).not.toMatch(/\brating\b/i);
  });
});
