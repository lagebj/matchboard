import { describe, it, expect } from "vitest";
import { getSeverityBadgeClasses, getReadinessClasses } from "../utils/issue-grouping";

describe("badge class helpers", () => {
  it("returns amber classes for ACTION_REQUIRED", () => {
    expect(getSeverityBadgeClasses("ACTION_REQUIRED")).toContain("amber");
  });

  it("returns red classes for BLOCKED", () => {
    expect(getSeverityBadgeClasses("BLOCKED")).toContain("red");
  });

  it("returns blue classes for WATCH", () => {
    expect(getSeverityBadgeClasses("WATCH")).toContain("blue");
  });

  it("returns emerald classes for READY readiness", () => {
    expect(getReadinessClasses("READY")).toContain("emerald");
  });

  it("returns amber classes for AT_RISK readiness", () => {
    expect(getReadinessClasses("AT_RISK")).toContain("amber");
  });
});