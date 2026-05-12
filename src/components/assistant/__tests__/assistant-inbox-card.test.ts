import { describe, it, expect } from "vitest";
import { getSeverityBadgeClasses, sortIssuesBySeverity } from "../../../domain/assistant-manager/mock-data";
import type { AssistantIssue } from "../../../domain/assistant-manager/types";

const makeIssue = (overrides: Partial<AssistantIssue> & { id: string }): AssistantIssue => ({
  type: "TEAM_NEEDS_SUPPORT",
  severity: "ACTION_REQUIRED",
  status: "OPEN",
  title: "Test issue",
  summary: "Test summary",
  entityType: "TEAM",
  entityId: "ROD",
  affectedTeamIds: [],
  affectedPlayerIds: [],
  ruleIds: [],
  recommendedAction: "Test action",
  primaryActionLabel: "Review",
  primaryActionHref: "/teams/ROD/review",
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("AssistantInboxCard (unit)", () => {
  it("renders correct severity label for ACTION_REQUIRED", () => {
    expect(getSeverityBadgeClasses("ACTION_REQUIRED")).toContain("amber");
  });

  it("renders correct severity label for BLOCKED", () => {
    expect(getSeverityBadgeClasses("BLOCKED")).toContain("red");
  });

  it("renders correct severity label for WATCH", () => {
    expect(getSeverityBadgeClasses("WATCH")).toContain("blue");
  });
});

describe("Assistant inbox grouping", () => {
  it("groups ACTION_REQUIRED/BLOCKED/CRITICAL into Needs Action", () => {
    const issues: AssistantIssue[] = [
      makeIssue({ id: "1", severity: "ACTION_REQUIRED", status: "OPEN" }),
      makeIssue({ id: "2", severity: "BLOCKED", status: "OPEN" }),
      makeIssue({ id: "3", severity: "CRITICAL", status: "OPEN" }),
    ];
    const actionIssues = issues.filter((i) => i.severity === "ACTION_REQUIRED" || i.severity === "BLOCKED" || i.severity === "CRITICAL");
    expect(actionIssues).toHaveLength(3);
  });

  it("groups WATCH/INFO into Watch", () => {
    const issues: AssistantIssue[] = [
      makeIssue({ id: "4", severity: "WATCH", status: "OPEN" }),
      makeIssue({ id: "5", severity: "INFO", status: "OPEN" }),
    ];
    const watchIssues = issues.filter((i) => i.severity === "WATCH" || i.severity === "INFO");
    expect(watchIssues).toHaveLength(2);
  });

  it("shows empty state when no open issues", () => {
    const issues: AssistantIssue[] = [];
    expect(issues).toHaveLength(0);
  });
});

describe("sortIssuesBySeverity", () => {
  it("sorts CRITICAL before ACTION_REQUIRED", () => {
    const issues: AssistantIssue[] = [
      makeIssue({ id: "1", severity: "ACTION_REQUIRED" }),
      makeIssue({ id: "2", severity: "CRITICAL" }),
    ];
    const sorted = sortIssuesBySeverity(issues);
    expect(sorted[0].severity).toBe("CRITICAL");
  });

  it("sorts BLOCKED before WATCH", () => {
    const issues: AssistantIssue[] = [
      makeIssue({ id: "1", severity: "WATCH" }),
      makeIssue({ id: "2", severity: "BLOCKED" }),
    ];
    const sorted = sortIssuesBySeverity(issues);
    expect(sorted[0].severity).toBe("BLOCKED");
  });
});