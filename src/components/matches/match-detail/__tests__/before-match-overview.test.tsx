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

// MatchTacticsPanel / CoachingIntentSelector / MatchFormatOverrideControls are already-working,
// unchanged, independently-covered components this page only newly mounts directly on Overview
// (post-launch correction, 2026-09-18) — mocked here to isolate BeforeMatchOverview's own
// composition from their internal data-fetching/mutation behaviour.
vi.mock("@/components/matches/match-tactics-panel", () => ({
  MatchTacticsPanel: (props: { matchId: string; planningEditable: boolean }) => (
    <div data-testid="match-tactics-panel">
      Pitch for {props.matchId} — editable: {String(props.planningEditable)}
    </div>
  ),
}));
vi.mock("@/components/matches/coaching-intent-selector", () => ({
  CoachingIntentSelector: () => <div data-testid="coaching-intent-selector" />,
}));
vi.mock("@/components/matches/match-format-override-controls", () => ({
  MatchFormatOverrideControls: () => <div data-testid="match-format-controls" />,
}));

const presentation = buildMatchPresentation({
  id: "m1",
  teamName: "Hvit",
  opponentName: "Huringen 1",
  isHome: true,
  kickoffAt: new Date("2026-09-23T18:00:00"),
  lifecycleStatus: "planning_open",
});

function baseProps(overrides: Partial<Parameters<typeof BeforeMatchOverview>[0]> = {}) {
  return {
    presentation,
    ownKitColor: null,
    preparationInput: { squadSelectedCount: 12, squadTarget: 11, hasLineup: true, hasPlannedRotation: false },
    venue: "HOME",
    matchType: "LEAGUE",
    gameFormat: "SEVEN_A_SIDE",
    matchFit: "UNKNOWN",
    matchId: "m1",
    teamId: "t1",
    teamName: "Hvit",
    selections: [{ playerId: "p1", playerName: "Emil", role: "CORE", primaryPosition: "CM", secondaryPosition: null, coreTeamName: "Hvit", absenceReason: null }],
    planningEditable: true,
    notes: null,
    rotationChangeCount: 0,
    opponentEncounterCount: 0,
    opponentHasProfile: false,
    tabHref: (t: string) => `?tab=${t}`,
    ...overrides,
  };
}

describe("BeforeMatchOverview", () => {
  it("renders the real pitch editor directly on Overview, not a formation-name summary", () => {
    render(<BeforeMatchOverview {...baseProps()} />);
    expect(screen.getByTestId("match-tactics-panel")).toBeInTheDocument();
    expect(screen.getByText(/Pitch for m1 — editable: true/)).toBeInTheDocument();
  });

  it("respects planningEditable (read-only once cancelled)", () => {
    render(<BeforeMatchOverview {...baseProps({ planningEditable: false })} />);
    expect(screen.getByText(/editable: false/)).toBeInTheDocument();
  });

  it("renders coaching intent and match format directly on Overview (former Tactics tab content)", () => {
    render(
      <BeforeMatchOverview
        {...baseProps({
          matchFormatState: {
            matchOverride: null,
            inheritedFormat: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
            liveReportingStarted: false,
            frozenFormat: null,
          },
        })}
      />,
    );
    expect(screen.getByTestId("coaching-intent-selector")).toBeInTheDocument();
    expect(screen.getByTestId("match-format-controls")).toBeInTheDocument();
  });

  it("renders squad readiness facts", () => {
    render(<BeforeMatchOverview {...baseProps()} />);
    expect(screen.getByText("12/11")).toBeInTheDocument();
  });

  it("never renders Player of the Match, MVP, or a rating concept", () => {
    render(<BeforeMatchOverview {...baseProps()} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/player of the match/i);
    expect(text).not.toMatch(/\bMVP\b/);
    expect(text).not.toMatch(/\brating\b/i);
  });
});
