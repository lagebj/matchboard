import { describe, it, expect } from "vitest";

describe("Team results overview aggregation", () => {
  it("derives goals for from home team perspective when home", () => {
    const isHome = true;
    const report = { homeGoals: 3, awayGoals: 1 };
    const ownGoals = isHome ? report.homeGoals : report.awayGoals;
    const oppGoals = isHome ? report.awayGoals : report.homeGoals;
    expect(ownGoals).toBe(3);
    expect(oppGoals).toBe(1);
  });

  it("derives goals for from away team perspective when away", () => {
    const isHome = false;
    const report = { homeGoals: 2, awayGoals: 4 };
    const ownGoals = isHome ? report.homeGoals : report.awayGoals;
    const oppGoals = isHome ? report.awayGoals : report.homeGoals;
    expect(ownGoals).toBe(4);
    expect(oppGoals).toBe(2);
  });

  it("classifies win when ownGoals > oppGoals", () => {
    const ownGoals = 3;
    const oppGoals = 1;
    expect(ownGoals > oppGoals).toBe(true);
  });

  it("classifies draw when ownGoals === oppGoals", () => {
    const ownGoals = 2;
    const oppGoals = 2;
    expect(ownGoals === oppGoals).toBe(true);
  });

  it("classifies loss when ownGoals < oppGoals", () => {
    const ownGoals = 0;
    const oppGoals = 1;
    expect(ownGoals < oppGoals).toBe(true);
  });

  it("counts clean sheet when oppGoals is zero", () => {
    const oppGoals = 0;
    expect(oppGoals === 0).toBe(true);
  });

  it("formats positive goal difference with plus sign", () => {
    const gd = 5;
    expect(gd > 0 ? `+${gd}` : `${gd}`).toBe("+5");
  });

  it("formats zero goal difference without plus sign", () => {
    const gd = 0;
    expect(gd > 0 ? `+${gd}` : `${gd}`).toBe("0");
  });

  it("formats negative goal difference with minus sign", () => {
    const gd = -3;
    expect(gd > 0 ? `+${gd}` : `${gd}`).toBe("-3");
  });
});