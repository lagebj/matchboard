import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound } from "@/lib/selection/save-generated-draft";
import { buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";
import { persistRoundExplanations } from "@/lib/selection/persist-explanations";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext();
let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * ARR-0043: player names must never be stored in selection explanations, warnings, or reasons —
 * those rows use player IDs; names are resolved for display only (AGENTS.md). This proves the
 * generation engine produces no persisted string that contains a fixture player's name.
 */
describe("no player names in persisted selection explanations / warnings / reasons (ARR-0043)", () => {
  let fixture: TestFixtureIds;
  /** Distinctive per-player name fragments the engine must never store — `${firstLetter}Player`. */
  let playerNameFragments: string[];

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);

    const players = await testDb.player.findMany({
      where: { organisationId: fixture.organisationId },
      select: { firstName: true, lastName: true },
    });
    playerNameFragments = [
      ...new Set(
        players.flatMap((p) => [p.firstName, p.lastName ? `${p.firstName} ${p.lastName}` : null].filter((v): v is string => !!v && v.length > 2)),
      ),
    ];

    // Full generation + persistence pipeline for the fixture round.
    const generated = await generateMatchRound(fixture.matchRoundId);
    await createGeneratedDraftRound(generated);
    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const [teamName, matchId] of Object.entries(fixture.matches)) {
      matchIdByTeamName.set(teamName, matchId);
      teamIdByTeamName.set(teamName, fixture.teams[teamName]!);
    }
    await persistRoundWarnings(
      buildPersistableWarnings(generated, matchIdByTeamName, teamIdByTeamName, fixture.organisationId),
    );
    await persistRoundExplanations(generated);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  function assertNoName(where: string, texts: (string | null | undefined)[]) {
    for (const text of texts) {
      if (!text) continue;
      for (const frag of playerNameFragments) {
        expect(text.includes(frag), `${where}: "${text}" contains player name fragment "${frag}"`).toBe(false);
      }
    }
  }

  it("Selection.selectionReason carries no player name", async () => {
    const rows = await testDb.selection.findMany({
      where: { matchRoundId: fixture.matchRoundId },
      select: { selectionReason: true },
    });
    expect(rows.length).toBeGreaterThan(0);
    assertNoName("Selection.selectionReason", rows.map((r) => r.selectionReason));
  });

  it("Selection.explanation JSON carries no player name", async () => {
    const rows = await testDb.selection.findMany({
      where: { matchRoundId: fixture.matchRoundId },
      select: { explanation: true },
    });
    assertNoName("Selection.explanation", rows.map((r) => (r.explanation == null ? null : JSON.stringify(r.explanation))));
  });

  it("SelectionExplanation rows carry no player name", async () => {
    const rows = await testDb.selectionExplanation.findMany({
      where: { matchId: { in: Object.values(fixture.matches) } },
    });
    assertNoName(
      "SelectionExplanation",
      rows.flatMap((r) => [
        r.summary,
        JSON.stringify(r.rulesApplied),
        JSON.stringify(r.blockers),
        JSON.stringify(r.warnings),
        JSON.stringify(r.recommendations),
        JSON.stringify(r.crossTeamImpacts),
      ]),
    );
  });

  it("Warning.message rows carry no player name", async () => {
    const rows = await testDb.warning.findMany({ where: { matchRoundId: fixture.matchRoundId } });
    assertNoName("Warning.message", rows.map((r) => r.message));
  });
});
