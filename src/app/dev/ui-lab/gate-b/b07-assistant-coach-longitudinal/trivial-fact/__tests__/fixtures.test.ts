import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, advisorViewModel } from "../fixtures";

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

describe("B07-B trivial-fact fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = hashOf(rawRecordsForHash);
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the hat-trick is recorded in canonical current-match data", () => {
    const noahGoals = timeline.filter((i) => i.kind === "GOAL_FOR" && i.playerName === "Noah");
    expect(noahGoals).toHaveLength(3);
  });

  it("the recorded chronology reconciles exactly with the final score", () => {
    const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
    const goalsAgainst = timeline.filter((i) => i.kind === "GOAL_AGAINST").length;
    expect(matchIdentity.score).toEqual({ home: goalsFor, away: goalsAgainst });
  });

  it("the Assistant Coach layer does not promote the hat-trick into a fabricated historical trend", () => {
    expect(advisorViewModel.insights).toEqual([]);
    expect(advisorViewModel.summary).not.toMatch(/hat-?trick|noah/i);
  });

  it("no fabricated prior encounters or development evidence exist", () => {
    expect(advisorViewModel.suggestions).toEqual([]);
    expect(advisorViewModel.clarification).toBeNull();
  });

  it("the insufficient-evidence state uses real product tone, not invented filler copy", () => {
    expect(advisorViewModel.summary).toBe("No historical pattern identified from the available evidence.");
  });

  it("never carries a forbidden fabricated metric", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("the stored fixtureSha256 has no self-reference inside its own hash input", () => {
    expect(JSON.stringify(rawRecordsForHash)).not.toContain(identity.fixtureSha256);
  });

  it("mutating the timeline changes the recomputed hash", () => {
    const mutated = { ...rawRecordsForHash, timeline: [...timeline.slice(0, -1), { ...timeline[timeline.length - 1]!, minuteLabel: "99'" }] };
    expect(hashOf(mutated)).not.toBe(identity.fixtureSha256);
  });
});
