import { describe, it, expect } from "vitest";
import { findFormationDataIssues } from "../normalize";

describe("findFormationDataIssues", () => {
  it("flags 7v7 formation without GOALKEEPER", () => {
    const issues = findFormationDataIssues({
      gameFormat: "SEVEN_A_SIDE",
      slots: [
        { gridX: 2, gridY: 0, label: "Striker", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
        { gridX: 2, gridY: 4, label: "Centre back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 1 },
      ],
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.message.includes("GOALKEEPER"))).toBe(true);
  });

  it("flags 3v3 formation with GOALKEEPER", () => {
    const issues = findFormationDataIssues({
      gameFormat: "THREE_A_SIDE",
      slots: [
        { gridX: 2, gridY: 0, label: "Forward", shortLabel: "F", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
        { gridX: 2, gridY: 5, label: "GK", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 1 },
      ],
    });
    expect(issues.some((i) => i.message.includes("3v3"))).toBe(true);
  });

  it("flags GOALKEEPER at wrong gridY", () => {
    const issues = findFormationDataIssues({
      gameFormat: "SEVEN_A_SIDE",
      slots: [
        { gridX: 2, gridY: 0, label: "GK", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 0 },
      ],
    });
    expect(issues.some((i) => i.message.includes("gridY 5"))).toBe(true);
  });

  it("flags FORWARD at deep gridY", () => {
    const issues = findFormationDataIssues({
      gameFormat: "SEVEN_A_SIDE",
      slots: [
        { gridX: 2, gridY: 4, label: "ST", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
        { gridX: 2, gridY: 5, label: "GK", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 1 },
      ],
    });
    expect(issues.some((i) => i.message.includes("FORWARD") && i.message.includes("gridY 0 or 1"))).toBe(true);
  });

  it("returns no issues for valid 7v7 GK + 2-3-1", () => {
    const issues = findFormationDataIssues({
      gameFormat: "SEVEN_A_SIDE",
      slots: [
        { gridX: 2, gridY: 0, label: "Striker", shortLabel: "ST", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
        { gridX: 1, gridY: 2, label: "Left mid", shortLabel: "LM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 1 },
        { gridX: 3, gridY: 2, label: "Right mid", shortLabel: "RM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 2 },
        { gridX: 1, gridY: 4, label: "Left back", shortLabel: "LB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 3 },
        { gridX: 3, gridY: 4, label: "Right back", shortLabel: "RB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 4 },
        { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 5 },
      ],
    });
    expect(issues).toEqual([]);
  });

  it("returns no issues for valid 3v3 1-1-1", () => {
    const issues = findFormationDataIssues({
      gameFormat: "THREE_A_SIDE",
      slots: [
        { gridX: 2, gridY: 0, label: "Forward", shortLabel: "F", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
        { gridX: 2, gridY: 2, label: "Midfielder", shortLabel: "M", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 1 },
        { gridX: 2, gridY: 4, label: "Deep", shortLabel: "D", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 2 },
      ],
    });
    expect(issues).toEqual([]);
  });
});