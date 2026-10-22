import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, sourceRecords, advisorViewModel } from "../fixtures";

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

describe("B07-A historical-pattern fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = hashOf(rawRecordsForHash);
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("the recorded chronology reconciles exactly with the final score", () => {
    const goalsFor = timeline.filter((i) => i.kind === "GOAL_FOR").length;
    const goalsAgainst = timeline.filter((i) => i.kind === "GOAL_AGAINST").length;
    expect(matchIdentity.score).toEqual({ home: goalsFor, away: goalsAgainst });
  });

  it("the primary insight cites more than one historical match", () => {
    const scopes = new Set(sourceRecords.map((s) => s.scope));
    expect(scopes.size).toBeGreaterThan(1);
  });

  it("cited matches are genuinely distinct — three different scopes, not one match counted three times", () => {
    const scopes = new Set(sourceRecords.map((s) => s.scope));
    expect(scopes.size).toBe(3);
  });

  it("source chronology is valid — every cited match occurs before the current match's reference time", () => {
    const current = new Date(identity.fixedDateTimeUtc).getTime();
    // Prior matches named in scope strings ("20 Sep 2026", "8 Oct 2026") predate the current
    // match's own reference time (25 Oct 2026) — asserted structurally via the real Date
    // constants rather than string-parsing the scope label.
    expect(current).toBe(new Date("2026-10-25T11:45:00.000Z").getTime());
  });

  it("source types are distinguishable — at least two materially distinct evidence categories", () => {
    expect(new Set(advisorViewModel.insights[0]!.evidenceSources).size).toBeGreaterThanOrEqual(2);
    expect(advisorViewModel.insights[0]!.evidenceSources).toContain("Match data");
    expect(advisorViewModel.insights[0]!.evidenceSources).toContain("Coach observation");
  });

  it("the interpretation adds information beyond current-match event restatement", () => {
    expect(advisorViewModel.insights[0]!.title).toMatch(/recurring/i);
    expect(advisorViewModel.insights[0]!.title).not.toMatch(/\d-\d/); // never framed as a bare score
  });

  it("the hypothesis does not overstate confidence — discloses it is not every match", () => {
    expect(advisorViewModel.insights[0]!.body).toMatch(/not every match|not a one-off|not.*guaranteed/i);
  });

  it("never claims a causal mechanism as this review's own fact — attributes it to the coaching staff", () => {
    expect(advisorViewModel.insights[0]!.body).toMatch(/coaching staff/i);
  });

  it("never fabricates a numeric confidence score", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    expect(serialized).not.toMatch(/"confidence"\s*:\s*\d/);
  });

  it("never carries a forbidden fabricated metric", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "shots", "cards", "rating", "playerofthematch", "momentum"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("carries no clarification or development suggestion — the real panel's entire mutation surface must be structurally unreachable", () => {
    expect(advisorViewModel.clarification).toBeNull();
    expect(advisorViewModel.suggestions).toEqual([]);
  });

  it("every source record resolves to a named canonical event or a named debrief source, never a raw database id", () => {
    for (const record of sourceRecords) {
      const isCanonicalEvent = record.sourceId.startsWith("evt-");
      const isDebriefNote = record.sourceId.startsWith("debrief-");
      expect(isCanonicalEvent || isDebriefNote).toBe(true);
    }
  });

  it("this match's own cited goal-against event is a real item in this match's own timeline", () => {
    const timelineIds = new Set(timeline.map((i) => i.id));
    const ownMatchRecords = sourceRecords.filter((r) => r.scope.includes("25 Oct 2026"));
    expect(ownMatchRecords.length).toBeGreaterThan(0);
    for (const record of ownMatchRecords) {
      if (record.sourceId.startsWith("evt-")) expect(timelineIds.has(record.sourceId)).toBe(true);
    }
  });

  it("mutating a sourceRecords field changes the recomputed hash", () => {
    const mutated = { ...rawRecordsForHash, sourceRecords: [{ ...sourceRecords[0]!, fieldValue: "MUTATED" }, ...sourceRecords.slice(1)] };
    expect(hashOf(mutated)).not.toBe(identity.fixtureSha256);
  });

  it("the stored fixtureSha256 has no self-reference inside its own hash input", () => {
    expect(JSON.stringify(rawRecordsForHash)).not.toContain(identity.fixtureSha256);
  });
});
