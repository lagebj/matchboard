import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { FixturesPage } from "../fixtures-page";
import type { FixturePeriod, FixtureRound, FixtureMatch } from "@/domain/fixtures/types";

vi.mock("@/domain/fixtures/actions", () => ({
  fetchFixturesOverview: vi.fn(),
}));

const { fetchFixturesOverview } = vi.mocked(
  await import("@/domain/fixtures/actions"),
);

const makeMatch = (overrides: Partial<FixtureMatch> = {}): FixtureMatch => ({
  id: "m1",
  title: "Bla vs Opponent",
  teamId: "team-1",
  teamName: "Bla",
  opponent: "Opponent",
  readinessState: "READY",
  selectedPlayerCount: 11,
  unresolvedIssueCount: 0,
  ...overrides,
});

const makeRound = (overrides: Partial<FixtureRound> = {}): FixtureRound => ({
  id: "r1",
  title: "Round 1",
  readinessState: "READY",
  generated: true,
  published: false,
  unresolvedIssueCount: 0,
  matches: [makeMatch()],
  ...overrides,
});

const makePeriod = (overrides: Partial<FixturePeriod> = {}): FixturePeriod => ({
  id: "p1",
  title: "Spring 2025",
  dateRange: "Jan – Jun",
  readinessState: "READY",
  unresolvedIssueCount: 0,
  rounds: [makeRound()],
  ...overrides,
});

describe("FixturesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders period, round, and match hierarchy", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod()],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Spring 2025")).toBeInTheDocument();
      expect(screen.getByText("Round 1")).toBeInTheDocument();
      expect(screen.getByText("Bla vs Opponent")).toBeInTheDocument();
    });
  });

  it("shows readiness badges for at-risk matches", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          readinessState: "AT_RISK",
          matches: [makeMatch({ readinessState: "AT_RISK" })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      const atRiskBadges = screen.getAllByText("At risk");
      expect(atRiskBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows empty state when no periods exist", async () => {
    fetchFixturesOverview.mockResolvedValue({ periods: [] });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("No planning periods found.")).toBeInTheDocument();
    });
  });

  it("shows selected player count per match", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          matches: [makeMatch({ selectedPlayerCount: 8 })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("8 selected")).toBeInTheDocument();
    });
  });

  it("shows not playable badge for hard-blocked matches", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          readinessState: "NOT_PLAYABLE",
          matches: [makeMatch({ readinessState: "NOT_PLAYABLE" })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      const notPlayableBadges = screen.getAllByText("Not playable");
      expect(notPlayableBadges.length).toBeGreaterThanOrEqual(1);
    });
  });
});