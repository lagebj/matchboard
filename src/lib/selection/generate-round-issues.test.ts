import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { generateRoundIssues } from "./generate-round-issues";

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

import { vi } from "vitest";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("generateRoundIssues", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns 0 when no warnings exist for the round", async () => {
    const count = await generateRoundIssues(fixture.matchRoundId);
    expect(count).toBe(0);
  });

  it("creates round-level HARD_BLOCKER issue when hard blocker warnings exist", async () => {
    const teamId = fixture.teams["Bla"]!;
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Bla"]!,
        teamId,
        severity: "HARD_BLOCK",
        rule: "player_in_multiple_matches",
        message: "Player selected in multiple matches",
      },
    });

    const count = await generateRoundIssues(fixture.matchRoundId);
    expect(count).toBeGreaterThanOrEqual(1);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: fixture.matchRoundId, entityType: "ROUND" },
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);
    const hardBlockerIssue = issues.find((i) => i.type === "BLOCKED_CONDITION_PREVENTS_FINALIZE");
    expect(hardBlockerIssue).toBeDefined();
    expect(hardBlockerIssue!.severity).toBe("BLOCKED");
    expect(hardBlockerIssue!.title).toContain("Blocked condition");
  });

  it("creates TEAM_NEEDS_SUPPORT issue for team-level warnings", async () => {
    const teamId = fixture.teams["Hvit"]!;
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Hvit"]!,
        teamId,
        severity: "REQUIRES_OVERRIDE",
        rule: "support_requirement_shortfall",
        message: "Hvit needs 2 support players",
      },
    });

    await generateRoundIssues(fixture.matchRoundId);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: teamId, entityType: "TEAM" },
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("TEAM_NEEDS_SUPPORT");
    expect(issues[0]!.primaryActionHref).toBe(`/teams/${teamId}/review`);
  });

  it("creates PLAYER issue for player-level warnings", async () => {
    const playerId = fixture.players[0]!.id;
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Bla"]!,
        playerId,
        severity: "WARNING",
        rule: "core_player_unselected",
        message: "Player not selected for core team",
      },
    });

    await generateRoundIssues(fixture.matchRoundId);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: playerId, entityType: "PLAYER" },
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("PLAYER_LOW_MATCH_EXPOSURE");
    expect(issues[0]!.primaryActionHref).toBe(`/players/${playerId}`);
  });

  it("does not duplicate issues when called twice with same warnings", async () => {
    await testDb.assistantIssue.deleteMany({});
    await testDb.warning.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });

    const teamId = fixture.teams["Rod"]!;
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Rod"]!,
        teamId,
        severity: "WARNING",
        rule: "short_squad",
        message: "Rod is below target squad size",
      },
    });

    const count1 = await generateRoundIssues(fixture.matchRoundId);
    expect(count1).toBeGreaterThanOrEqual(1);

    const count2 = await generateRoundIssues(fixture.matchRoundId);
    expect(count2).toBe(0);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: teamId, entityType: "TEAM" },
    });
    expect(issues.length).toBe(1);
  });

  it("maps WARNING severity to WATCH issue severity", async () => {
    await testDb.assistantIssue.deleteMany({});
    await testDb.warning.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });

    const teamId = fixture.teams["Bla"]!;
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Bla"]!,
        teamId,
        severity: "WARNING",
        rule: "support_avoid_suitability",
        message: "Support candidate not suitable",
      },
    });

    await generateRoundIssues(fixture.matchRoundId);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: teamId, entityType: "TEAM" },
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe("WATCH");
  });

  it("maps REQUIRES_OVERRIDE severity to ACTION_REQUIRED issue severity", async () => {
    await testDb.assistantIssue.deleteMany({});
    await testDb.warning.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });

    const teamId = fixture.teams["Hvit"]!;
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Hvit"]!,
        teamId,
        severity: "REQUIRES_OVERRIDE",
        rule: "squad_below_minimum",
        message: "Squad below minimum size",
      },
    });

    await generateRoundIssues(fixture.matchRoundId);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: teamId, entityType: "TEAM" },
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe("ACTION_REQUIRED");
  });

  it("groups multiple warnings for same team into one issue", async () => {
    await testDb.assistantIssue.deleteMany({});
    await testDb.warning.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });

    const teamId = fixture.teams["Rod"]!;
    await testDb.warning.createMany({
      data: [
        {
          matchRoundId: fixture.matchRoundId,
          matchId: fixture.matches["Rod"]!,
          teamId,
          severity: "WARNING",
          rule: "short_squad",
          message: "Below target",
        },
        {
          matchRoundId: fixture.matchRoundId,
          matchId: fixture.matches["Rod"]!,
          teamId,
          severity: "WARNING",
          rule: "support_avoid_suitability",
          message: "Unsuitable support",
        },
      ],
    });

    await generateRoundIssues(fixture.matchRoundId);

    const issues = await testDb.assistantIssue.findMany({
      where: { entityId: teamId, entityType: "TEAM" },
    });
    expect(issues.length).toBe(1);
    expect(issues[0]!.ruleIds).toContain("short_squad");
    expect(issues[0]!.ruleIds).toContain("support_avoid_suitability");
  });

  it("uses worst severity when team has mixed warning severities", async () => {
    await testDb.assistantIssue.deleteMany({});
    await testDb.warning.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });

    const teamId = fixture.teams["Bla"]!;
    await testDb.warning.createMany({
      data: [
        {
          matchRoundId: fixture.matchRoundId,
          matchId: fixture.matches["Bla"]!,
          teamId,
          severity: "WARNING",
          rule: "short_squad",
          message: "Below target",
        },
        {
          matchRoundId: fixture.matchRoundId,
          matchId: fixture.matches["Bla"]!,
          teamId,
          severity: "HARD_BLOCK",
          rule: "player_in_multiple_matches",
          message: "Player conflict",
        },
      ],
    });

    await generateRoundIssues(fixture.matchRoundId);

    const teamIssues = await testDb.assistantIssue.findMany({
      where: { entityId: teamId, entityType: "TEAM" },
    });
    expect(teamIssues.length).toBe(1);
    expect(teamIssues[0]!.severity).toBe("BLOCKED");
  });

  it("generates issues for multiple teams independently", async () => {
    await testDb.assistantIssue.deleteMany({});
    await testDb.warning.deleteMany({ where: { matchRoundId: fixture.matchRoundId } });

    const teamA = fixture.teams["Bla"]!;
    const teamB = fixture.teams["Hvit"]!;

    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Bla"]!,
        teamId: teamA,
        severity: "WARNING",
        rule: "short_squad",
        message: "Bla below target",
      },
    });
    await testDb.warning.create({
      data: {
        matchRoundId: fixture.matchRoundId,
        matchId: fixture.matches["Hvit"]!,
        teamId: teamB,
        severity: "REQUIRES_OVERRIDE",
        rule: "support_requirement_shortfall",
        message: "Hvit needs support",
      },
    });

    await generateRoundIssues(fixture.matchRoundId);

    const teamAIssues = await testDb.assistantIssue.findMany({
      where: { entityId: teamA, entityType: "TEAM" },
    });
    const teamBIssues = await testDb.assistantIssue.findMany({
      where: { entityId: teamB, entityType: "TEAM" },
    });
    expect(teamAIssues.length).toBe(1);
    expect(teamBIssues.length).toBe(1);
    expect(teamAIssues[0]!.severity).toBe("WATCH");
    expect(teamBIssues[0]!.severity).toBe("ACTION_REQUIRED");
  });
});