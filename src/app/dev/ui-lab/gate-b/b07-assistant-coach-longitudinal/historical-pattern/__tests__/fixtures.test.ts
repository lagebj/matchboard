import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity, timeline, sourceRecords, advisorViewModel } from "../fixtures";
import {
  B07_PRIOR1_KICKOFF_AT,
  B07_PRIOR1_OPPONENT_NAME,
  B07_PRIOR1_DEBRIEF_NOTE,
  B07_PRIOR2_KICKOFF_AT,
  B07_PRIOR2_OPPONENT_NAME,
  B07_PRIOR2_DEBRIEF_NOTE,
  B07_HISTORICAL_KICKOFF_AT,
  B07_HISTORICAL_OPPONENT_NAME,
  B07_HISTORICAL_DEBRIEF_NOTE,
} from "../../../shared/match-b-fixture";
// Test-only import — safe here (no cycle risk): `match-b-fixture.ts` itself does NOT import
// `B05_MATCH_FORMAT` (that would create a real circular import, since `report-data.ts` already
// imports from `match-b-fixture.ts` — see W4-R5 in SOURCE_RECONCILIATION.md for why the fixture
// module hardcodes the literal "60'" instead). This test file has no such constraint.
import { B05_MATCH_FORMAT } from "../../../b05-post-match-report/shared/report-data";

function hashOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** All OTHER opponent names this fixture bundle ever uses for a DIFFERENT match — a debrief note
 * mentioning one of these (instead of its own match's real opponent) is exactly the W4-R6 bug. */
const OTHER_OPPONENT_NAMES = [B07_PRIOR1_OPPONENT_NAME, B07_PRIOR2_OPPONENT_NAME, B07_HISTORICAL_OPPONENT_NAME];

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

  describe("match-format validity (W4-R5)", () => {
    it("every timeline event's global minute is within regulation (60 minutes, B05_MATCH_FORMAT)", () => {
      for (const item of timeline) {
        const minute = Number(item.minuteLabel?.replace(/'/g, ""));
        expect(minute).not.toBeNaN();
        expect(minute).toBeLessThanOrEqual(B05_MATCH_FORMAT.regulationDurationMinutes);
        expect(minute).toBeGreaterThanOrEqual(0);
      }
    });

    it("MATCH_END occurs exactly at the format's regulation duration, not an invented 80-minute full-time", () => {
      const end = timeline.find((i) => i.kind === "MATCH_END");
      expect(end?.minuteLabel).toBe(`${B05_MATCH_FORMAT.regulationDurationMinutes}'`);
    });

    it("events remain in chronological order after the W4-R5 correction", () => {
      const minutes = timeline.map((i) => Number(i.minuteLabel?.replace(/'/g, "")));
      for (let i = 1; i < minutes.length; i++) {
        expect(minutes[i]!).toBeGreaterThanOrEqual(minutes[i - 1]!);
      }
    });

    it("every historical source record's cited minute is also within regulation", () => {
      for (const record of sourceRecords) {
        const match = record.fieldValue.match(/^(\d+)'/);
        if (!match) continue; // debrief-note records have no minute to check
        const minute = Number(match[1]);
        expect(minute).toBeLessThanOrEqual(B05_MATCH_FORMAT.regulationDurationMinutes);
      }
    });

    it("NEGATIVE regression: the original invalid 66'/74'/80' pattern would fail this bound — guards against silent reintroduction", () => {
      const invalidMinutes = [66, 74, 80];
      const allWithinRegulation = invalidMinutes.every((m) => m <= B05_MATCH_FORMAT.regulationDurationMinutes);
      expect(allWithinRegulation).toBe(false);
    });

    it("NEGATIVE regression: the original invalid 61' prior-match source minute would also fail this bound", () => {
      expect(61 <= B05_MATCH_FORMAT.regulationDurationMinutes).toBe(false);
    });
  });

  describe("opponent identity and evidence provenance (W4-R6)", () => {
    it("each match's own debrief note never names a DIFFERENT match's opponent", () => {
      const notes: { note: string; ownOpponent: string }[] = [
        { note: B07_PRIOR1_DEBRIEF_NOTE, ownOpponent: B07_PRIOR1_OPPONENT_NAME },
        { note: B07_PRIOR2_DEBRIEF_NOTE, ownOpponent: B07_PRIOR2_OPPONENT_NAME },
        { note: B07_HISTORICAL_DEBRIEF_NOTE, ownOpponent: B07_HISTORICAL_OPPONENT_NAME },
      ];
      for (const { note, ownOpponent } of notes) {
        for (const otherOpponent of OTHER_OPPONENT_NAMES) {
          if (otherOpponent === ownOpponent) continue;
          // A short team-name fragment (e.g. "Fjellhug" inside "Fjellhug IF") is enough to catch
          // the exact W4-R6 bug (prior1's note named "Bærum", the HISTORICAL match's opponent).
          const fragment = otherOpponent.split(" ")[0]!;
          expect(note).not.toContain(fragment);
        }
      }
    });

    it("every cited prior match's kickoff genuinely precedes the current match's own reference time", () => {
      const current = new Date(identity.fixedDateTimeUtc).getTime();
      expect(B07_PRIOR1_KICKOFF_AT.getTime()).toBeLessThan(current);
      expect(B07_PRIOR2_KICKOFF_AT.getTime()).toBeLessThan(current);
      expect(B07_PRIOR1_KICKOFF_AT.getTime()).toBeLessThan(B07_PRIOR2_KICKOFF_AT.getTime());
      expect(B07_PRIOR2_KICKOFF_AT.getTime()).toBeLessThan(B07_HISTORICAL_KICKOFF_AT.getTime());
    });

    it("the current match's own reference time is after its own kickoff, not the kickoff instant itself", () => {
      const reference = new Date(identity.fixedDateTimeUtc).getTime();
      expect(reference).toBeGreaterThan(B07_HISTORICAL_KICKOFF_AT.getTime());
    });
  });

  it("the primary insight cites more than one historical match", () => {
    const scopes = new Set(sourceRecords.map((s) => s.scope));
    expect(scopes.size).toBeGreaterThan(1);
  });

  it("cited matches are genuinely distinct — three different scopes, not one match counted three times", () => {
    const scopes = new Set(sourceRecords.map((s) => s.scope));
    expect(scopes.size).toBe(3);
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
    expect(advisorViewModel.insights[0]!.body).toMatch(/not necessarily every match|not a one-off|not.*guarantee/i);
  });

  it("never claims a causal mechanism as this review's own fact — attributes it to the coaching staff", () => {
    expect(advisorViewModel.insights[0]!.body).toMatch(/coaching staff/i);
  });

  it("W4-R7: never claims these are the team's 'last N' matches — bounds coverage to what this review includes", () => {
    const serialized = JSON.stringify(advisorViewModel).toLowerCase();
    expect(serialized).not.toMatch(/last 2|last two/);
    expect(advisorViewModel.insights[0]!.body).toMatch(/included in this review/i);
  });

  it("W4-R7: doesn't assert the timing alone proves the cause — the debrief note is what connects it", () => {
    expect(advisorViewModel.insights[0]!.body).toMatch(/not the timing by itself|debrief notes? that connect/i);
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
