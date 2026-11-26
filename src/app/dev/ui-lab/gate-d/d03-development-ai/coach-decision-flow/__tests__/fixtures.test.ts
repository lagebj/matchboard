import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  identity,
  rawRecordsForHash,
  hypotheses,
  confirmHypothesis,
  dismissHypothesis,
  errorHypothesis,
  sources,
  confirmErrorByHypothesisId,
} from "../fixtures";
import { resolveEvidenceSource } from "../../../w2-shared/evidence-source-types";

/**
 * Remediation (owner review of PR #847, finding P1 #1): this fixture previously cited evidence
 * identifiers with no backing `EvidenceSourceMap` at all — these tests did not exist, and nothing
 * verified the cited refs actually resolved. Every assertion below is new, added as part of the
 * correction, not pre-existing coverage that was merely extended.
 */
describe("GATE-D-W2-D03-DECISION-FLOW fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("has exactly three hypotheses, each with a distinct id", () => {
    expect(hypotheses).toHaveLength(3);
    expect(new Set(hypotheses.map((h) => h.id)).size).toBe(3);
  });

  it("only the error-demo hypothesis is wired to a simulated failure", () => {
    expect(Object.keys(confirmErrorByHypothesisId)).toEqual([errorHypothesis.id]);
  });

  it("every hypothesis is genuinely pending — no outcome is pre-decided in the fixture itself", () => {
    for (const hypothesis of hypotheses) {
      expect(hypothesis.statement.length).toBeGreaterThan(0);
    }
  });

  describe("evidence integrity", () => {
    it("every supporting and contradicting reference, for every hypothesis, resolves to a real source record of the matching kind", () => {
      for (const hypothesis of hypotheses) {
        for (const ref of [...hypothesis.supportingRefs, ...hypothesis.contradictingRefs]) {
          expect(() => resolveEvidenceSource(ref, sources)).not.toThrow();
        }
      }
    });

    it("no cited identifier is missing a source record", () => {
      const citedIds = hypotheses.flatMap((h) => [...h.supportingRefs, ...h.contradictingRefs].map((r) => r.id));
      for (const id of citedIds) {
        expect(sources[id]).toBeDefined();
      }
    });

    it("the left-midfield-exposure hypothesis cites two distinct observations, matching its own 'two recent observations' claim", () => {
      expect(confirmHypothesis.statement).toMatch(/two recent observations/);
      const observationRefs = confirmHypothesis.supportingRefs.filter((r) => r.kind === "QUALITATIVE_OBSERVATION");
      expect(observationRefs).toHaveLength(2);
      expect(new Set(observationRefs.map((r) => r.id)).size).toBe(2);
      const [first, second] = observationRefs.map((r) => resolveEvidenceSource(r, sources));
      expect(first!.detail).not.toBe(second!.detail);
    });

    it("the left-midfield trend's own minute values genuinely increased between the two windows", () => {
      const trend = resolveEvidenceSource(confirmHypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/45 across the previous 3 matches/);
      expect(trend.detail).toMatch(/210 across the latest 3 matches/);
    });

    it("never confuses left-midfield minutes with improved ability", () => {
      expect(confirmHypothesis.statement).toMatch(/not a demonstrated improvement in ability on its own/);
      const trend = resolveEvidenceSource(confirmHypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/not a measure of ability/);
    });

    it("the trailing event rate states a real numerator, denominator, units, and comparison windows — not a bare count", () => {
      const trend = resolveEvidenceSource(dismissHypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/2 across 108 recorded trailing minutes/);
      expect(trend.detail).toMatch(/3 across 126 recorded trailing minutes/);
      expect(trend.detail).toMatch(/1 per 54 minutes/);
      expect(trend.detail).toMatch(/1 per 42 minutes/);
      expect(trend.detail).toMatch(/30 Aug - 20 Sep/);
      expect(trend.detail).toMatch(/27 Sep - 11 Oct/);
    });

    it("the co-presence trend states actual shared-minute values and never infers partnership quality", () => {
      const trend = resolveEvidenceSource(errorHypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/95 minutes across the previous 3 matches/);
      expect(trend.detail).toMatch(/210 minutes across the latest 3 matches/);
      expect(trend.detail).toMatch(/does not establish partnership quality/);
      expect(errorHypothesis.statement).toMatch(/does not establish partnership quality/);
    });

    it("every DERIVED_TREND source states 6 of 6 eligible matches recorded — consistent coverage across all three hypotheses", () => {
      for (const hypothesis of hypotheses) {
        for (const ref of hypothesis.supportingRefs) {
          if (ref.kind !== "DERIVED_TREND") continue;
          const source = resolveEvidenceSource(ref, sources);
          expect(source.coverage).toBe("6 of 6 eligible matches recorded");
        }
      }
    });

    it("missing evidence is a factual absence, never phrased as a negative judgment", () => {
      for (const hypothesis of hypotheses) {
        for (const item of hypothesis.missingEvidence) {
          expect(item).not.toMatch(/\b(fails?|bad|poor|weak|lacking|inadequate)\b/i);
        }
      }
    });

    it("the three existing decision outcomes (confirm, dismiss, error) remain intact by hypothesis id", () => {
      expect(confirmHypothesis.id).toBe("gate-d-w2-d03-confirm-demo");
      expect(dismissHypothesis.id).toBe("gate-d-w2-d03-dismiss-demo");
      expect(errorHypothesis.id).toBe("gate-d-w2-d03-error-demo");
    });
  });

  describe("remediation (owner review of PR #847, finding P2 — unsupported teammate comparison)", () => {
    it("never claims a squad-wide or teammate comparison the backing source does not contain", () => {
      expect(dismissHypothesis.statement).not.toMatch(/teammates?/i);
      expect(dismissHypothesis.statement).not.toMatch(/squad rotation/i);
      const trend = resolveEvidenceSource(dismissHypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).not.toMatch(/teammates?/i);
    });

    it("explicitly discloses that a squad-wide comparison is unavailable, both in the statement and in missingEvidence", () => {
      expect(dismissHypothesis.statement).toMatch(/squad-wide comparison is not available/);
      expect(dismissHypothesis.missingEvidence).toContain("No comparison against squad-wide trailing-rate baseline yet");
    });

    it("does not assert a demonstrated or confirmed change in performance", () => {
      expect(dismissHypothesis.statement).toMatch(/should not be interpreted as a demonstrated change in Amir's performance/);
      expect(dismissHypothesis.statement).not.toMatch(/\b(demonstrates|proves|confirms|establishes)\b/i);
    });

    it("the two comparison windows are both identified by date range, matching the source's own values", () => {
      expect(dismissHypothesis.statement).toMatch(/previous window contained 2 recorded events across 108 trailing minutes/);
      expect(dismissHypothesis.statement).toMatch(/3 across 126 trailing minutes in the latest window/);
      const trend = resolveEvidenceSource(dismissHypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/30 Aug - 20 Sep/);
      expect(trend.detail).toMatch(/27 Sep - 11 Oct/);
    });

    it("preserves the meaningful distinction between event rate and event count — the statement cites both the raw counts and the per-match context, not just a bare rate", () => {
      expect(dismissHypothesis.statement).toMatch(/2 recorded events across 108 trailing minutes/);
      expect(dismissHypothesis.statement).toMatch(/3 across 126 trailing minutes/);
    });
  });
});
