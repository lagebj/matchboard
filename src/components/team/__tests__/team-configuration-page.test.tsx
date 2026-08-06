import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { TeamConfigurationPage } from "../team-configuration-page";
import type { TeamConfiguration } from "@/domain/team-configuration/types";

vi.mock("@/domain/team-configuration/actions", () => ({
  fetchTeamConfiguration: vi.fn(),
  updateTeamConfigurationAction: vi.fn(),
}));

const { fetchTeamConfiguration } = vi.mocked(
  await import("@/domain/team-configuration/actions"),
);

function makeConfig(overrides: Partial<TeamConfiguration> = {}): TeamConfiguration {
  return {
    teamId: "team-1",
    name: "Bla",
    coreGroup: "12 active players",
    active: true,
    targetSquadSize: 11,
    minAcceptedSquadSize: 7,
    maxSquadSize: 14,
    minCorePlayers: 5,
    supportPriority: 3,
    minSupportPlayers: 1,
    developmentSlots: 2,
    footballGroupId: "group-1",
    footballGroup: { id: "group-1", name: "Boys 2015", slug: "boys-2015", type: "AGE_GROUP" },
    rules: [
      { ruleId: "own-core", name: "Own core first", description: "Core first.", scope: "GLOBAL", enabled: true, editable: false },
      { ruleId: "support-priority", name: "Support priority", description: "Lower number wins.", scope: "TEAM", enabled: true, editable: true, value: "Priority 3" },
      { ruleId: "squad-cap", name: "Squad cap", description: "Max size.", scope: "TEAM", enabled: true, editable: true, value: "Max 14" },
    ],
    ...overrides,
  };
}

describe("TeamConfigurationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders team name and identity", async () => {
    fetchTeamConfiguration.mockResolvedValue(makeConfig());

    await act(() => {
      render(<TeamConfigurationPage teamId="team-1" />);
    });

    await waitFor(() => {
      const names = screen.getAllByText("Bla");
      expect(names.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("12 active players")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("renders squad settings form", async () => {
    fetchTeamConfiguration.mockResolvedValue(makeConfig());

    await act(() => {
      render(<TeamConfigurationPage teamId="team-1" />);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("11")).toBeInTheDocument();
      expect(screen.getByDisplayValue("14")).toBeInTheDocument();
      expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    });
  });

  it("renders rule names and descriptions", async () => {
    fetchTeamConfiguration.mockResolvedValue(makeConfig());

    await act(() => {
      render(<TeamConfigurationPage teamId="team-1" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Own core first")).toBeInTheDocument();
      expect(screen.getByText("Support priority")).toBeInTheDocument();
      expect(screen.getByText("Squad cap")).toBeInTheDocument();
    });
  });

  it("shows Edit buttons for editable rules and Read-only for global rules", async () => {
    fetchTeamConfiguration.mockResolvedValue(makeConfig());

    await act(() => {
      render(<TeamConfigurationPage teamId="team-1" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Edit")).toHaveLength(2);
      expect(screen.getByText("Read-only")).toBeInTheDocument();
    });
  });

  it("shows team not found for null config", async () => {
    fetchTeamConfiguration.mockResolvedValue(null);

    await act(() => {
      render(<TeamConfigurationPage teamId="nonexistent" />);
    });

    await waitFor(() => {
      expect(screen.getByText("Team not found.")).toBeInTheDocument();
    });
  });
});