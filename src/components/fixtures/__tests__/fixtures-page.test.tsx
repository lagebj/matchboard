import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { FixturesPage } from "../fixtures-page";
import type { FixturePeriod, FixtureRound, FixtureMatch } from "@/domain/fixtures/types";

const searchParamsState = vi.hoisted(() => ({ value: new URLSearchParams() }));
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => searchParamsState.value,
}));

vi.mock("@/domain/fixtures/actions", () => ({
  fetchFixturesOverview: vi.fn(),
  fixturePopulateAllAction: vi.fn(),
}));

const { fetchFixturesOverview } = vi.mocked(await import("@/domain/fixtures/actions"));

const makeMatch = (overrides: Partial<FixtureMatch> = {}): FixtureMatch => ({
  id: "m1",
  title: "Blå vs Opponent",
  teamId: "team-1",
  teamName: "Blå",
  opponent: "Opponent",
  readinessState: "READY",
  selectionState: "READY",
  selectedPlayerCount: 12,
  blockerCount: 0,
  decisionRequiredCount: 0,
  reportState: { state: "NO_REPORT" },
  availableActions: ["createDraft"],
  matchStatus: "SCHEDULED",
  cancelledReason: null,
  lifecycleStatus: "planning_open",
  teamKitColor: "BLUE",
  lineupState: "PREPARED",
  planningSignals: [],
  ...overrides,
});

const makeRound = (overrides: Partial<FixtureRound> = {}): FixtureRound => ({
  id: "r1",
  title: "Round 1",
  readinessState: "READY",
  selectionState: "READY",
  hasDraftSelections: false,
  hasMatches: true,
  blockerCount: 0,
  decisionRequiredCount: 0,
  availableActions: ["createDraft"],
  matches: [makeMatch()],
  roundLevelPlanningSignals: [],
  ...overrides,
});

const makePeriod = (overrides: Partial<FixturePeriod> = {}): FixturePeriod => ({
  id: "p1",
  title: "Spring 2025",
  dateRange: "Jan – Jun",
  startDate: "2025-01-01T00:00:00.000Z",
  endDate: "2025-06-30T00:00:00.000Z",
  readinessState: "READY",
  blockerCount: 0,
  decisionRequiredCount: 0,
  rounds: [makeRound()],
  isCurrent: false,
  ...overrides,
});

// A fixed "now" — tests set each round's `startsAt` relative to this instant so temporal
// classification (current/past/future) is real and deterministic rather than tied to the actual
// clock.
const NOW = new Date();

function isoAt(daysFromNow: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

describe("FixturesPage (League Operating Surface)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = new URLSearchParams();
  });

  it("renders the active period title and the focused round's matches", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [
        makePeriod({
          rounds: [makeRound({ matches: [makeMatch({ startsAt: isoAt(0) })] })],
        }),
      ],
    });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText((_, el) => (el?.textContent ?? "").startsWith("Spring 2025")).length).toBeGreaterThan(0);
      expect(screen.getByText("Blå")).toBeInTheDocument();
    });
  });

  it("defaults to the period marked isCurrent, not periods[0]", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [
        makePeriod({ id: "old", title: "Spring 2025", isCurrent: false }),
        makePeriod({ id: "current", title: "Fall 2026", isCurrent: true }),
      ],
    });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText((_, el) => (el?.textContent ?? "").startsWith("Fall 2026")).length).toBeGreaterThan(0);
    });
  });

  it("falls back to periods[0] when no period is marked isCurrent", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [
        makePeriod({ id: "old", title: "Spring 2025", isCurrent: false }),
        makePeriod({ id: "older", title: "Fall 2024", isCurrent: false }),
      ],
    });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText((_, el) => (el?.textContent ?? "").startsWith("Spring 2025")).length).toBeGreaterThan(0);
    });
  });

  it("shows empty state when no periods exist", async () => {
    fetchFixturesOverview.mockResolvedValue({ periods: [] });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getByText("No league seasons found.")).toBeInTheDocument();
    });
  });

  it("focuses the round named by the `round` URL query param over the temporal default", async () => {
    searchParamsState.value = new URLSearchParams("round=r-other");
    fetchFixturesOverview.mockResolvedValue({
      periods: [
        makePeriod({
          rounds: [
            makeRound({ id: "r1", title: "Round 1", matches: [makeMatch({ id: "m1", teamName: "Blå", startsAt: isoAt(0) })] }),
            makeRound({ id: "r-other", title: "Round 2", matches: [makeMatch({ id: "m2", teamName: "Rød", startsAt: isoAt(21) })] }),
          ],
        }),
      ],
    });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Round 2")).toBeInTheDocument();
      expect(screen.getByText("Rød")).toBeInTheDocument();
    });
  });

  it("shows a cancelled state and reason for cancelled matches in the focused round", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [
        makePeriod({
          rounds: [
            makeRound({
              matches: [
                makeMatch({
                  startsAt: isoAt(0),
                  matchStatus: "CANCELLED",
                  cancelledReason: "Weather",
                }),
              ],
            }),
          ],
        }),
      ],
    });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
      expect(screen.getByText(/Weather/)).toBeInTheDocument();
    });
  });

  it("shows 'Generate all draft squads' as the primary action when the focused round needs generation", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [
        makePeriod({
          rounds: [makeRound({ id: "r1", title: "Round 1", selectionState: "NOT_GENERATED", matches: [] })],
        }),
      ],
    });

    await act(() => {
      render(<FixturesPage orgSlug="test-org" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Generate all draft squads").length).toBeGreaterThanOrEqual(1);
    });
  });
});
