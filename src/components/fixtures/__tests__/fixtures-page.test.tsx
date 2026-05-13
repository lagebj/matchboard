import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { FixturesPage } from "../fixtures-page";
import type { FixturePeriod, FixtureRound, FixtureMatch } from "@/domain/fixtures/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/domain/fixtures/actions", () => ({
  fetchFixturesOverview: vi.fn(),
  fixturePopulateAllAction: vi.fn(),
  fixtureRegenerateAllAction: vi.fn(),
  fixtureClearAllDraftsAction: vi.fn(),
  fixtureGenerateRoundAction: vi.fn(),
  fixtureRegenerateRoundAction: vi.fn(),
  fixtureClearRoundDraftAction: vi.fn(),
  fixtureFinalizeRoundAction: vi.fn(),
  fixtureUnfinalizeRoundAction: vi.fn(),
  fixtureRegenerateMatchAction: vi.fn(),
  fixtureClearMatchDraftAction: vi.fn(),
  fixtureFinalizeMatchAction: vi.fn(),
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
  selectionState: "NOT_GENERATED",
  selectedPlayerCount: 0,
  unresolvedIssueCount: 0,
  availableActions: ["createDraft"],
  ...overrides,
});

const makeRound = (overrides: Partial<FixtureRound> = {}): FixtureRound => ({
  id: "r1",
  title: "Round 1",
  readinessState: "READY",
  selectionState: "NOT_GENERATED",
  hasDraftSelections: false,
  hasMatches: true,
  unresolvedIssueCount: 0,
  availableActions: ["createDraft"],
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

  it("shows empty state when no periods exist", async () => {
    fetchFixturesOverview.mockResolvedValue({ periods: [] });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("No planning periods found.")).toBeInTheDocument();
    });
  });

  it("shows selection state badges per match", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          selectionState: "DRAFT",
          availableActions: ["recreateDraft", "clearDraft", "finalize"],
          matches: [makeMatch({
            selectionState: "DRAFT",
            selectedPlayerCount: 8,
            availableActions: ["recreateDraft", "clearDraft", "finalize"],
          })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("8 selected")).toBeInTheDocument();
      const draftBadges = screen.getAllByText("Draft");
      expect(draftBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows blocked state badge for hard-blocked rounds", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          selectionState: "BLOCKED",
          readinessState: "NOT_PLAYABLE",
          availableActions: ["recreateDraft", "clearDraft", "finalize"],
          matches: [makeMatch({ selectionState: "DRAFT", availableActions: ["recreateDraft", "clearDraft", "finalize"] })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      const blockedBadges = screen.getAllByText("Blocked");
      expect(blockedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows finalize action for ready rounds", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          selectionState: "READY",
          availableActions: ["recreateDraft", "clearDraft", "finalize"],
          matches: [makeMatch({
            selectionState: "DRAFT",
            availableActions: ["recreateDraft", "clearDraft", "finalize"],
          })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Finalize round")).toBeInTheDocument();
    });
  });

  it("shows populate all action for periods with not-generated rounds", async () => {
    fetchFixturesOverview.mockResolvedValue({
      periods: [makePeriod({
        rounds: [makeRound({
          selectionState: "NOT_GENERATED",
          availableActions: ["createDraft"],
          matches: [makeMatch({ selectionState: "NOT_GENERATED", availableActions: ["createDraft"] })],
        })],
      })],
    });

    await act(() => {
      render(<FixturesPage />);
    });

    await waitFor(() => {
      const populateButtons = screen.getAllByText("Populate all rounds");
      expect(populateButtons.length).toBeGreaterThanOrEqual(1);
    });
  });
});