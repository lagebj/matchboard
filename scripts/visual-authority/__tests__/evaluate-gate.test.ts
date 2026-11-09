import { describe, it, expect } from "vitest";
import { evaluateGateFromScenarios } from "../evaluate-gate.mjs";

const HEAD = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

function scenarioResult(overrides: Record<string, unknown> = {}) {
  return {
    scenarioId: "B01",
    state: "APPROVED",
    source: "PR_COMMENT",
    approvedBy: "lagebj",
    approvedAt: "2026-01-01T00:00:00Z",
    approvedRevision: HEAD,
    reason: "Approved.",
    ...overrides,
  };
}

describe("evaluateGateFromScenarios", () => {
  it("reports NOT_APPLICABLE when not applicable, regardless of scenario results", () => {
    const result = evaluateGateFromScenarios({
      applicable: false,
      scenarioResults: new Map([["B01", scenarioResult({ state: "REJECTED" })]]),
      errors: [],
    });
    expect(result.state).toBe("NOT_APPLICABLE");
    expect(result.conclusion).toBe("success");
  });

  it("reports INVALID when the resolver surfaced a malformed-command error, even with otherwise-approved scenarios", () => {
    const result = evaluateGateFromScenarios({
      applicable: true,
      scenarioResults: new Map([["B01", scenarioResult()]]),
      errors: ["Comment from @lagebj references unknown scenario ID(s): B99"],
    });
    expect(result.state).toBe("INVALID");
    expect(result.conclusion).toBe("failure");
  });

  it("reports APPROVED only when every applicable scenario is approved", () => {
    const result = evaluateGateFromScenarios({
      applicable: true,
      scenarioResults: new Map([
        ["B01", scenarioResult({ scenarioId: "B01" })],
        ["B04", scenarioResult({ scenarioId: "B04" })],
      ]),
      errors: [],
    });
    expect(result.state).toBe("APPROVED");
    expect(result.conclusion).toBe("success");
  });

  it("reports AWAITING_APPROVAL when one scenario is approved but another is not (partial approval)", () => {
    const result = evaluateGateFromScenarios({
      applicable: true,
      scenarioResults: new Map([
        ["B01", scenarioResult({ scenarioId: "B01", state: "APPROVED" })],
        ["B04", scenarioResult({ scenarioId: "B04", state: "AWAITING_APPROVAL", source: null, approvedBy: null })],
      ]),
      errors: [],
    });
    expect(result.state).toBe("AWAITING_APPROVAL");
    expect(result.conclusion).toBe("failure");
  });

  it("reports INVALID when any scenario is REJECTED, even if others are approved", () => {
    const result = evaluateGateFromScenarios({
      applicable: true,
      scenarioResults: new Map([
        ["B01", scenarioResult({ scenarioId: "B01", state: "APPROVED" })],
        ["B04", scenarioResult({ scenarioId: "B04", state: "REJECTED", source: "PR_COMMENT", approvedBy: null })],
      ]),
      errors: [],
    });
    expect(result.state).toBe("INVALID");
    expect(result.conclusion).toBe("failure");
  });

  it("reports INVALID when any scenario is STALE", () => {
    const result = evaluateGateFromScenarios({
      applicable: true,
      scenarioResults: new Map([["B01", scenarioResult({ state: "STALE" })]]),
      errors: [],
    });
    expect(result.state).toBe("INVALID");
    expect(result.conclusion).toBe("failure");
  });

  it("fails closed with AWAITING_APPROVAL when applicable but no scenario registry entries resolved at all", () => {
    const result = evaluateGateFromScenarios({ applicable: true, scenarioResults: new Map(), errors: [] });
    expect(result.state).toBe("AWAITING_APPROVAL");
    expect(result.conclusion).toBe("failure");
  });

  it.each([
    ["NOT_APPLICABLE", "success"],
    ["APPROVED", "success"],
    ["AWAITING_APPROVAL", "failure"],
    ["INVALID", "failure"],
  ] as const)(
    "%s always reports conclusion %s — GitHub's required-status-checks merge gate treats success/skipped/neutral as passing and only failure as blocking",
    (state, conclusion) => {
      const args =
        state === "NOT_APPLICABLE"
          ? { applicable: false, scenarioResults: new Map(), errors: [] }
          : state === "APPROVED"
            ? { applicable: true, scenarioResults: new Map([["B01", scenarioResult()]]), errors: [] }
            : state === "AWAITING_APPROVAL"
              ? { applicable: true, scenarioResults: new Map([["B01", scenarioResult({ state: "AWAITING_APPROVAL", source: null, approvedBy: null })]]), errors: [] }
              : { applicable: true, scenarioResults: new Map([["B01", scenarioResult({ state: "STALE" })]]), errors: [] };
      const result = evaluateGateFromScenarios(args);
      expect(result.state).toBe(state);
      expect(result.conclusion).toBe(conclusion);
      expect(["success", "failure"]).toContain(result.conclusion); // never "neutral" — see evaluate-gate.mjs header
    },
  );
});
