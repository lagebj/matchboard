import { describe, it, expect } from "vitest";
import { buildPlayerListViewModel, type PlayerListViewModelInput } from "../player-list-view-model";

function makeInput(overrides: Partial<PlayerListViewModelInput> = {}): PlayerListViewModelInput {
  return {
    roster: [],
    selectedPlayerId: null,
    inspector: null,
    ...overrides,
  };
}

describe("buildPlayerListViewModel", () => {
  it("passes the roster through unchanged", () => {
    const roster = [
      {
        playerId: "p1",
        displayName: "Adam Haddad",
        coreTeamName: "Fjordvik Rød",
        primaryPosition: "CM",
        availability: "AVAILABLE",
        actualAppearances: 5,
        coreAppearances: 4,
        supportAppearances: 1,
        developmentAppearances: 0,
        attention: null,
      },
    ];
    expect(buildPlayerListViewModel(makeInput({ roster })).roster).toBe(roster);
  });

  it("passes selectedPlayerId and inspector through unchanged when null", () => {
    const vm = buildPlayerListViewModel(makeInput());
    expect(vm.selectedPlayerId).toBeNull();
    expect(vm.inspector).toBeNull();
  });

  it("passes a populated inspector through unchanged", () => {
    const inspector = {
      playerId: "p1",
      displayName: "Adam Haddad",
      coreTeamName: "Fjordvik Rød",
      primaryPosition: "CM",
      seasonAppearances: 5,
      seasonGoals: 2,
      seasonAssists: 1,
      positionExposure: [],
      availability: "AVAILABLE",
      developmentFocus: null,
    };
    const vm = buildPlayerListViewModel(makeInput({ selectedPlayerId: "p1", inspector }));
    expect(vm.selectedPlayerId).toBe("p1");
    expect(vm.inspector).toBe(inspector);
  });
});
