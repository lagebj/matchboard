import { describe, it, expect } from "vitest";
import { getSeverityBadgeClasses, getReadinessClasses } from "../utils/issue-grouping";

// Token names asserted here, not literal Tailwind palette names (e.g. "amber", "red") — the
// helpers were migrated from raw dark-only Tailwind literals to theme-aware Touchline tokens
// (ADR-0134). The category -> tone mapping is what these tests actually verify.
describe("badge class helpers", () => {
  it("returns warning classes for ACTION_REQUIRED", () => {
    expect(getSeverityBadgeClasses("ACTION_REQUIRED")).toContain("--warning");
  });

  it("returns danger classes for BLOCKED", () => {
    expect(getSeverityBadgeClasses("BLOCKED")).toContain("--danger");
  });

  it("returns info classes for WATCH", () => {
    expect(getSeverityBadgeClasses("WATCH")).toContain("--info");
  });

  it("returns success classes for READY readiness", () => {
    expect(getReadinessClasses("READY")).toContain("--success");
  });

  it("returns warning classes for AT_RISK readiness", () => {
    expect(getReadinessClasses("AT_RISK")).toContain("--warning");
  });
});
