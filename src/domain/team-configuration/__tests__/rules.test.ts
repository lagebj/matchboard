import { describe, it, expect } from "vitest";
import { KNOWN_RULES } from "../service";

describe("Team Configuration rules", () => {
  it("has 7 known rules", () => {
    expect(KNOWN_RULES).toHaveLength(7);
  });

  it("has 2 editable rules", () => {
    const editable = KNOWN_RULES.filter((r) => r.editable);
    expect(editable).toHaveLength(2);
    expect(editable.map((r) => r.ruleId)).toContain("support-priority");
    expect(editable.map((r) => r.ruleId)).toContain("squad-size-cap");
  });

  it("has 5 global rules", () => {
    const global = KNOWN_RULES.filter((r) => r.scope === "GLOBAL");
    expect(global).toHaveLength(5);
  });

  it("all rules have required fields", () => {
    for (const rule of KNOWN_RULES) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(rule.scope).toMatch(/^(GLOBAL|TEAM)$/);
      expect(typeof rule.enabled).toBe("boolean");
      expect(typeof rule.editable).toBe("boolean");
    }
  });
});