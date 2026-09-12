import { describe, it, expect } from "vitest";
import { buildPlayerParticipationSummary } from "../get-player-participation-summary";

describe("buildPlayerParticipationSummary", () => {
  it("maps all-time stats into labeled metric strip items in order", () => {
    const items = buildPlayerParticipationSummary({ actualAppearances: 12, goals: 4, assists: 2, plannedButAbsent: 1 });
    expect(items).toEqual([
      { id: "played", label: "Played", value: "12" },
      { id: "goals", label: "Goals", value: "4" },
      { id: "assists", label: "Assists", value: "2" },
      { id: "planned-absent", label: "Planned absent", value: "1" },
    ]);
  });

  it("renders zeros for a player with no recorded participation", () => {
    const items = buildPlayerParticipationSummary({ actualAppearances: 0, goals: 0, assists: 0, plannedButAbsent: 0 });
    expect(items.every((i) => i.value === "0")).toBe(true);
  });
});
