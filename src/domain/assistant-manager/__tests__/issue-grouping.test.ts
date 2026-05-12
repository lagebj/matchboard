import { describe, it, expect } from "vitest";
import {
  groupIssues,
  sortIssuesBySeverity,
  getSeverityBadgeClasses,
  getStatusBadgeClasses,
  getReadinessClasses,
} from "../utils/issue-grouping";
import type { AssistantIssue } from "../types";

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

describe("groupIssues", () => {
  it("groups ACTION_REQUIRED/BLOCKED/CRITICAL into needs_action", () => {
    const issues = [
      makeIssue({ id: "1", severity: "ACTION_REQUIRED", status: "OPEN" }),
      makeIssue({ id: "2", severity: "BLOCKED", status: "OPEN" }),
      makeIssue({ id: "3", severity: "CRITICAL", status: "OPEN" }),
    ];
    const groups = groupIssues(issues);
    expect(groups.needs_action).toHaveLength(3);
    expect(groups.watch).toHaveLength(0);
  });

  it("groups WATCH/INFO into watch", () => {
    const issues = [
      makeIssue({ id: "4", severity: "WATCH", status: "OPEN" }),
      makeIssue({ id: "5", severity: "INFO", status: "OPEN" }),
    ];
    const groups = groupIssues(issues);
    expect(groups.watch).toHaveLength(2);
    expect(groups.needs_action).toHaveLength(0);
  });

  it("groups RESOLVED/DISMISSED into recently_resolved", () => {
    const issues = [
      makeIssue({ id: "6", severity: "ACTION_REQUIRED", status: "RESOLVED" }),
      makeIssue({ id: "7", severity: "WATCH", status: "DISMISSED" }),
    ];
    const groups = groupIssues(issues);
    expect(groups.recently_resolved).toHaveLength(2);
  });

  it("groups STALE WATCH/INFO into upcoming", () => {
    const issues = [makeIssue({ id: "8", severity: "WATCH", status: "STALE" })];
    const groups = groupIssues(issues);
    expect(groups.upcoming).toHaveLength(1);
    expect(groups.watch).toHaveLength(0);
  });

  it("returns empty groups for empty input", () => {
    const groups = groupIssues([]);
    expect(groups.needs_action).toHaveLength(0);
    expect(groups.watch).toHaveLength(0);
    expect(groups.recently_resolved).toHaveLength(0);
    expect(groups.upcoming).toHaveLength(0);
  });
});

describe("sortIssuesBySeverity", () => {
  it("sorts CRITICAL before ACTION_REQUIRED", () => {
    const issues = [
      makeIssue({ id: "1", severity: "ACTION_REQUIRED" }),
      makeIssue({ id: "2", severity: "CRITICAL" }),
    ];
    const sorted = sortIssuesBySeverity(issues);
    expect(sorted[0].severity).toBe("CRITICAL");
  });

  it("sorts BLOCKED before WATCH", () => {
    const issues = [
      makeIssue({ id: "1", severity: "WATCH" }),
      makeIssue({ id: "2", severity: "BLOCKED" }),
    ];
    const sorted = sortIssuesBySeverity(issues);
    expect(sorted[0].severity).toBe("BLOCKED");
  });

  it("does not mutate original array", () => {
    const issues = [
      makeIssue({ id: "1", severity: "WATCH" }),
      makeIssue({ id: "2", severity: "CRITICAL" }),
    ];
    const original = [...issues];
    sortIssuesBySeverity(issues);
    expect(issues.map((i) => i.id)).toEqual(original.map((i) => i.id));
  });
});

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

  it("returns emerald classes for RESOLVED status", () => {
    expect(getStatusBadgeClasses("RESOLVED")).toContain("emerald");
  });

  it("returns emerald classes for READY readiness", () => {
    expect(getReadinessClasses("READY")).toContain("emerald");
  });

  it("returns amber classes for AT_RISK readiness", () => {
    expect(getReadinessClasses("AT_RISK")).toContain("amber");
  });
});