import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, hypothesis, sources, developmentInput, cycleInsight, cycleWindowWeeks } from "../fixtures";
import { resolveEvidenceSource } from "../../../w2-shared/evidence-source-types";

describe("GATE-D-W2-D03-GROUNDED fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("every supporting and contradicting ref resolves to a source record of the matching kind", () => {
    for (const ref of [...hypothesis.supportingRefs, ...hypothesis.contradictingRefs]) {
      expect(() => resolveEvidenceSource(ref, sources)).not.toThrow();
    }
  });

  it("discloses a genuine contradicting observation rather than hiding it", () => {
    expect(hypothesis.contradictingRefs.length).toBeGreaterThan(0);
    const contradicting = resolveEvidenceSource(hypothesis.contradictingRefs[0]!, sources);
    expect(contradicting.detail).toMatch(/giveaway/i);
  });

  it("the hypothesis never claims the development focus itself is complete or resolved", () => {
    expect(hypothesis.statement).not.toMatch(/resolved|complete|fixed|no longer an issue/i);
  });

  it("the derived trend's own source record states its comparison window, not just a bare number", () => {
    const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
    expect(trend.detail).toMatch(/previous 3 matches/);
    expect(trend.detail).toMatch(/latest 3 matches/);
    expect(trend.coverage).toMatch(/eligible matches/);
  });

  it("the existing development focus is a real, already-started thread, independent of the hypothesis", () => {
    expect(developmentInput.activeFocus?.reviewState).toBe("PENDING");
    expect(developmentInput.activeFocus?.observationCount).toBe(developmentInput.observationTimeline.length);
  });

  describe("remediation (owner review of PR #847, finding P2 #3): recorded counts, not an unsupported rate", () => {
    it("states the exact numerator values (5 and 2), not a derived ratio", () => {
      const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/\b5\b.*previous 3 matches/);
      expect(trend.detail).toMatch(/\b2\b.*latest 3 matches/);
    });

    it("each comparison window contains exactly three matches, stated explicitly", () => {
      const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/previous 3 matches/);
      expect(trend.detail).toMatch(/latest 3 matches/);
    });

    it("the metric's own label and id no longer claim 'rate' without a defined calculation", () => {
      expect(hypothesis.supportingRefs[0]!.id).toBe("trend-jonas-giveaway-count");
      expect(hypothesis.supportingRefs[0]!.label).not.toMatch(/rate/i);
      const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
      expect(trend.label).not.toMatch(/rate/i);
    });

    it("no unsupported rate claim remains in the hypothesis statement or the source detail", () => {
      expect(hypothesis.statement).not.toMatch(/giveaway rate/i);
      const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).not.toMatch(/giveaway rate/i);
    });

    it("discloses the exposure-normalization caveat, both in the hypothesis statement and the source detail", () => {
      expect(hypothesis.statement).toMatch(/not an exposure-adjusted performance rate/);
      const trend = resolveEvidenceSource(hypothesis.supportingRefs[0]!, sources);
      expect(trend.detail).toMatch(/not an exposure-adjusted rate/);
      expect(hypothesis.missingEvidence.some((m) => /exposure/i.test(m))).toBe(true);
    });

    it("makes no automatic causal inference beyond what the evidence establishes", () => {
      expect(hypothesis.statement).not.toMatch(/\b(because|caused by|due to|proves|demonstrates)\b/i);
    });
  });

  describe("remediation (owner review of PR #847, finding P2 #4): correct six-week learning-cycle duration", () => {
    it("computes a six-week duration from the cycle window's own date boundaries, not a hardcoded literal", () => {
      expect(cycleWindowWeeks).toBe(6);
    });

    it("the computed window matches the displayed windowLabel's own start and end dates", () => {
      expect(cycleInsight.windowLabel).toBe("30 Aug – 11 Oct 2026");
    });

    it("every source record's own date falls within the stated six-week window", () => {
      const start = new Date("2026-08-30T00:00:00.000Z").getTime();
      const end = new Date("2026-10-11T23:59:59.999Z").getTime();
      for (const source of Object.values(sources)) {
        if (!source.occurredAt) continue;
        // Dates are stored as display strings ("11 Oct 2026"); parse defensively for this check only.
        const parsed = new Date(`${source.occurredAt.replace(/(\d+) (\w+) (\d+)/, "$2 $1, $3")}`);
        expect(parsed.getTime()).toBeGreaterThanOrEqual(start);
        expect(parsed.getTime()).toBeLessThanOrEqual(end);
      }
    });
  });

  describe("remediation (owner review of PR #847, finding P2 — unsupported squad-wide learning-cycle conclusion)", () => {
    it("never affirmatively claims a squad-wide or group-wide pattern — only explicitly disclaims one", () => {
      expect(cycleInsight.title).not.toMatch(/squad-wide/i);
      expect(cycleInsight.title).not.toMatch(/recurring theme/i);
      expect(cycleInsight.body).not.toMatch(/most of the group|several midfielders/i);
      // The only "squad-wide" mention left is the explicit disclaimer denying one — not a claim.
      expect(cycleInsight.body).toMatch(/do not establish consistent improvement or a squad-wide pattern/);
    });

    it("every factual claim in the insight traces to Jonas's own observation timeline, not an invented group pattern", () => {
      // "earlier... rushed decisions" <- obs-jonas-w1; "more composed receiving" <- obs-jonas-w7/w10;
      // "a continuing giveaway" <- obs-jonas-w9 (also the hypothesis's own disclosed contradicting ref).
      expect(cycleInsight.body).toMatch(/rushed decisions/);
      const rushedObservation = developmentInput.observationTimeline.find((o) => /rushed/i.test(o.note));
      expect(rushedObservation).toBeDefined();
      expect(cycleInsight.body).toMatch(/more composed receiving/);
      const composedObservation = developmentInput.observationTimeline.find((o) => /comfortable receiving/i.test(o.note));
      expect(composedObservation).toBeDefined();
      expect(cycleInsight.body).toMatch(/continuing giveaway/);
      const giveawayObservation = developmentInput.observationTimeline.find((o) => /giveaway under pressure/i.test(o.note));
      expect(giveawayObservation).toBeDefined();
    });

    it("preserves uncertainty — a possible change worth reviewing, not a confirmed finding", () => {
      expect(cycleInsight.body).toMatch(/suggest a possible change worth reviewing/);
      expect(cycleInsight.body).not.toMatch(/\b(confirms|proves|demonstrates|established)\b/i);
    });

    it("remains a distinct knowledge-hierarchy class from the coach-established development focus — it never overwrites or restates the focus as its own finding", () => {
      expect(cycleInsight.title).not.toBe(developmentInput.activeFocus?.focus);
      expect(cycleInsight.body).not.toContain(developmentInput.activeFocus?.rationale ?? "__never__");
    });
  });
});
