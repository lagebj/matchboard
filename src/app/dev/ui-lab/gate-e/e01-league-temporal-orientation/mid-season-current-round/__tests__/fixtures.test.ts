import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, springPeriod, autumnPeriod } from "../fixtures";
import { buildLeagueOperatingViewModel } from "@/lib/touchline/presentation/league-view-model";

describe("GATE-E-W1-E01-MID-SEASON fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("Spring 2027's rounds reconcile: Round 9's kickoff is in the same week as `now`, classified CURRENT by the real view model", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.activePeriod?.id).toBe(springPeriod.id);
    expect(vm.focusedRound?.id).toBe("gate-e-w1-e01-mid-round-9");
    expect(vm.focusedRound?.status).toBe("CURRENT_ROUND");
    expect(vm.focusedRound?.statusLabel).toBe("Current round");
  });

  it("Round 9 surfaces its real attention count without losing its CURRENT_ROUND identity (XR-T01: temporal identity is never replaced by attention state)", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.focusedRound?.attentionCount).toBeGreaterThan(0);
    expect(vm.focusedRound?.status).toBe("CURRENT_ROUND");
  });

  it("Round 7's cancelled match is excluded from closure computation — the round still closes FINAL on its one real result", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: "gate-e-w1-e01-mid-round-7",
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.focusedRound?.status).toBe("FINAL");
  });

  it("Round 8 (report missing) is the most recent round needing closure, distinct from Round 7 (FINAL)", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    const recentIds = vm.recentRounds.map((r) => r.id);
    expect(recentIds).toContain("gate-e-w1-e01-mid-round-8");
    expect(vm.recentRounds.find((r) => r.id === "gate-e-w1-e01-mid-round-8")?.status).toBe("NEEDS_CLOSURE");
    expect(vm.recentRounds.find((r) => r.id === "gate-e-w1-e01-mid-round-7")?.status).toBe("FINAL");
  });

  it("Round 6 is pushed into the collapsed earlier-rounds disclosure, not the always-visible recent history", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.recentRounds.map((r) => r.id)).not.toContain("gate-e-w1-e01-mid-round-6");
    expect(vm.earlierRounds.map((r) => r.id)).toContain("gate-e-w1-e01-mid-round-6");
  });

  it("Round 10 (NOT_GENERATED, future) and Round 11 (READY, future) are both quiet UPCOMING rail slots, separated by a genuinely empty rail week", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    const r10Slot = vm.railSlots.find((s) => s.roundIds.includes("gate-e-w1-e01-mid-round-10"));
    const r11Slot = vm.railSlots.find((s) => s.roundIds.includes("gate-e-w1-e01-mid-round-11"));
    expect(r10Slot?.state).toBe("UPCOMING");
    expect(r11Slot?.state).toBe("UPCOMING");
    expect(vm.railSlots.some((s) => s.state === "EMPTY")).toBe(true);
  });

  it("Round 10 and Round 11 resolve to distinct focused statuses on drill-down (NOT_GENERATED vs READY), even though their rail slots look the same", () => {
    const vm10 = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: "gate-e-w1-e01-mid-round-10",
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    const vm11 = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: null,
      selectedRoundId: "gate-e-w1-e01-mid-round-11",
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm10.focusedRound?.status).toBe("NOT_GENERATED");
    expect(vm11.focusedRound?.status).toBe("READY");
  });

  it("switching to Autumn 2026 re-resolves focus to its own NEEDS_CLOSURE round, never carrying over Spring's CURRENT_ROUND label", () => {
    const vm = buildLeagueOperatingViewModel({
      periods: [springPeriod, autumnPeriod],
      selectedPeriodId: autumnPeriod.id,
      selectedRoundId: null,
      now: new Date("2027-03-15T09:00:00.000Z"),
    });
    expect(vm.activePeriod?.id).toBe(autumnPeriod.id);
    expect(vm.focusedRound?.id).toBe("gate-e-w1-e01-mid-autumn-round-2");
    expect(vm.focusedRound?.status).toBe("NEEDS_CLOSURE");
  });
});
