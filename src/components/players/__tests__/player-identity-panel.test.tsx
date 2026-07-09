import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayerIdentityPanel } from "@/components/players/player-identity-panel";

const mockUpdateFieldAction = vi.fn().mockResolvedValue({ success: true });

const basePlayer = {
  id: "p1",
  firstName: "Test",
  lastName: "Player",
  shirtNumber: null,
  coreTeamId: "team-1",
  primaryPosition: "CM",
  secondaryPosition: null,
  tertiaryPosition: null,
  goalkeeperAbility: "NO",
  preferredFoot: "RIGHT",
  secondaryFoot: "WEAK",
  bestSide: "CENTER",
  currentAvailability: "AVAILABLE",
  nonRotatable: false,
  reducedMatchLoadAllowed: false,
  notes: null,
  supportInstruction: null,
  developmentInstruction: null,
  ballControl: null,
  passing: null,
  firstTouch: null,
  oneVOneAttacking: null,
  positioning: null,
  oneVOneDefending: null,
  decisionMaking: null,
  effort: null,
  teamplay: null,
  concentration: null,
  speed: null,
  strength: null,
  coreTeam: { id: "team-1", name: "Team A" },
};

const baseTeams = [{ id: "team-1", name: "Team A" }];

const positionOptions = [
  { label: "CM", value: "CM" },
  { label: "FW", value: "FW" },
];

const optionalPositionOptions = [
  { label: "None", value: "" },
  { label: "CM", value: "CM" },
  { label: "FW", value: "FW" },
];

const footOptions = [
  { label: "Right", value: "RIGHT" },
  { label: "Left", value: "LEFT" },
];

const secondaryFootOptions = [
  { label: "Weak", value: "WEAK" },
  { label: "Strong", value: "STRONG" },
];

const bestSideOptions = [
  { label: "Center", value: "CENTER" },
  { label: "Left", value: "LEFT" },
  { label: "Right", value: "RIGHT" },
];

const goalkeeperAbilityOptions = [
  { label: "No", value: "NO" },
  { label: "Emergency", value: "EMERGENCY" },
  { label: "Yes", value: "YES" },
];

const availabilityOptions = [
  { label: "Available", value: "AVAILABLE" },
  { label: "Injured", value: "INJURED" },
  { label: "Unknown", value: "UNKNOWN" },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

describe("PlayerIdentityPanel — editable attributes", () => {
  it("renders all 12 attribute fields as editable controls", () => {
    render(
      <PlayerIdentityPanel
        player={basePlayer}
        teams={baseTeams}
        availabilityOptions={availabilityOptions}
        positionOptions={positionOptions}
        optionalPositionOptions={optionalPositionOptions}
        footOptions={footOptions}
        secondaryFootOptions={secondaryFootOptions}
        bestSideOptions={bestSideOptions}
        goalkeeperAbilityOptions={goalkeeperAbilityOptions}
        updateFieldAction={mockUpdateFieldAction}
      />,
    );

    const attributeLabels = [
      "Ball control",
      "Passing",
      "First Touch",
      "1v1 Attacking",
      "Positioning",
      "1v1 Defending",
      "Decision Making",
      "Effort",
      "Team Play",
      "Concentration",
      "Speed",
      "Strength",
    ];

    for (const label of attributeLabels) {
      expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
    }
  });

  it("displays 'Not rated' for null attribute values", () => {
    render(
      <PlayerIdentityPanel
        player={basePlayer}
        teams={baseTeams}
        availabilityOptions={availabilityOptions}
        positionOptions={positionOptions}
        optionalPositionOptions={optionalPositionOptions}
        footOptions={footOptions}
        secondaryFootOptions={secondaryFootOptions}
        bestSideOptions={bestSideOptions}
        goalkeeperAbilityOptions={goalkeeperAbilityOptions}
        updateFieldAction={mockUpdateFieldAction}
      />,
    );

    const notRatedElements = screen.getAllByText("Not rated");
    expect(notRatedElements.length).toBe(12);
  });

  it("displays numeric values for rated attributes", () => {
    const ratedPlayer = {
      ...basePlayer,
      ballControl: 3,
      passing: 4,
      effort: 5,
    };

    render(
      <PlayerIdentityPanel
        player={ratedPlayer}
        teams={baseTeams}
        availabilityOptions={availabilityOptions}
        positionOptions={positionOptions}
        optionalPositionOptions={optionalPositionOptions}
        footOptions={footOptions}
        secondaryFootOptions={secondaryFootOptions}
        bestSideOptions={bestSideOptions}
        goalkeeperAbilityOptions={goalkeeperAbilityOptions}
        updateFieldAction={mockUpdateFieldAction}
      />,
    );

    expect(screen.getByLabelText(/Ball control/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls updateFieldAction with correct field name and value when saving", async () => {
    mockUpdateFieldAction.mockClear();

    render(
      <PlayerIdentityPanel
        player={basePlayer}
        teams={baseTeams}
        availabilityOptions={availabilityOptions}
        positionOptions={positionOptions}
        optionalPositionOptions={optionalPositionOptions}
        footOptions={footOptions}
        secondaryFootOptions={secondaryFootOptions}
        bestSideOptions={bestSideOptions}
        goalkeeperAbilityOptions={goalkeeperAbilityOptions}
        updateFieldAction={mockUpdateFieldAction}
      />,
    );

    const ballControlControl = screen.getByLabelText(/Ball control/);
    fireEvent.click(ballControlControl);

    await waitFor(() => {
      const select = screen.getByRole("combobox", { name: /Ball control/ });
      fireEvent.change(select, { target: { value: "3" } });
    });

    const saveButton = screen.getByRole("button", { name: /Save/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateFieldAction).toHaveBeenCalledWith("p1", "ballControl", "3");
    });
  });

  it("does not display 5 or max for unrated players", () => {
    render(
      <PlayerIdentityPanel
        player={basePlayer}
        teams={baseTeams}
        availabilityOptions={availabilityOptions}
        positionOptions={positionOptions}
        optionalPositionOptions={optionalPositionOptions}
        footOptions={footOptions}
        secondaryFootOptions={secondaryFootOptions}
        bestSideOptions={bestSideOptions}
        goalkeeperAbilityOptions={goalkeeperAbilityOptions}
        updateFieldAction={mockUpdateFieldAction}
      />,
    );

    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });
});