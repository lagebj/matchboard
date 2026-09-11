import { describe, it, expect } from "vitest";
import { buildMatchPresentation } from "@/lib/matches/match-presentation";
import {
  buildTodayViewModel,
  summarizeSquadStatus,
  type TodayViewModelInput,
  type TodayDecisionInput,
} from "../today-view-model";

const baseInput: TodayViewModelInput = {
  dateLabel: "Thursday · 10 September 2026",
  nextMatch: buildMatchPresentation({
    id: "m1",
    href: "/matches/m1",
    teamName: "Rød",
    opponentName: "Graabein United",
    isHome: true,
    kickoffAt: "2026-09-12T13:00:00",
    lifecycleStatus: "planning_open",
  }),
  decisions: [],
  dueDecisionReviews: [],
  recentMatches: [],
  scheduleItems: [],
  squadStatusPlayers: null,
  evidenceSpotlight: null,
};

describe("buildTodayViewModel", () => {
  it("uses the next match as hero when no blocking decision exists", () => {
    const vm = buildTodayViewModel(baseInput);
    expect(vm.heroKind).toBe("match");
    expect(vm.heroMatch?.id).toBe("m1");
    expect(vm.heroDecision).toBeNull();
  });

  it("promotes an IMMEDIATE-urgency decision to the hero over the next match", () => {
    const vm = buildTodayViewModel({
      ...baseInput,
      decisions: [
        { id: "d1", title: "Squad below minimum", urgency: "IMMEDIATE", visibility: "PROMOTE" },
        { id: "d2", title: "Decision required", urgency: "SOON", visibility: "NORMAL" },
      ],
    });
    expect(vm.heroKind).toBe("attention");
    expect(vm.heroDecision?.id).toBe("d1");
    expect(vm.heroMatch).toBeNull();
    // The blocking decision itself is not duplicated into the attention list.
    expect(vm.attentionItems.map((d) => d.id)).toEqual(["d2"]);
  });

  it("excludes SUPPRESS/DEFER decisions and caps the attention list at 4 with an overflow count", () => {
    const decisions: TodayDecisionInput[] = Array.from({ length: 6 }, (_, i) => ({
      id: `d${i}`,
      title: `Item ${i}`,
      urgency: "NORMAL",
      visibility: "NORMAL",
    }));
    decisions.push({ id: "suppressed", title: "hidden", urgency: "LOW", visibility: "SUPPRESS" });
    decisions.push({ id: "deferred", title: "later", urgency: "LOW", visibility: "DEFER" });

    const vm = buildTodayViewModel({ ...baseInput, decisions });
    expect(vm.attentionItems).toHaveLength(4);
    expect(vm.attentionOverflowCount).toBe(2);
    expect(vm.attentionItems.some((d) => d.id === "suppressed" || d.id === "deferred")).toBe(false);
  });

  it("returns a null squad status when no player data is supplied", () => {
    const vm = buildTodayViewModel(baseInput);
    expect(vm.squadStatus).toBeNull();
  });
});

describe("summarizeSquadStatus", () => {
  it("groups players into available/doubtful/unavailable and lists the non-available with reasons", () => {
    const summary = summarizeSquadStatus([
      { playerId: "1", displayName: "Oliver Hansen", availability: "AVAILABLE" },
      { playerId: "2", displayName: "Marius Dahl", availability: "TENTATIVE" },
      { playerId: "3", displayName: "Sander Nilsen", availability: "SICK" },
      { playerId: "4", displayName: "Emil Olsen", availability: "INJURED" },
    ]);
    expect(summary.available).toBe(1);
    expect(summary.doubtful).toBe(1);
    expect(summary.unavailable).toBe(2);
    expect(summary.notAvailable).toEqual([
      { playerId: "2", displayName: "Marius Dahl", reason: "Questionable" },
      { playerId: "3", displayName: "Sander Nilsen", reason: "Illness" },
      { playerId: "4", displayName: "Emil Olsen", reason: "Injured" },
    ]);
  });

  it("returns all-zero counts for an empty roster", () => {
    const summary = summarizeSquadStatus([]);
    expect(summary).toEqual({ available: 0, doubtful: 0, unavailable: 0, notAvailable: [] });
  });
});
