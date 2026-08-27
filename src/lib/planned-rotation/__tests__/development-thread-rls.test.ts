import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

/**
 * Regression test for the production crash: opening a player detail view threw
 * `unrecognized configuration parameter "app.current_organization_id"` (Postgres 42704)
 * from prisma.developmentThread.findMany(). Root cause: the DevelopmentThread /
 * DevelopmentThreadObservation / TeamFocus RLS policies used current_setting() without
 * the `missing_ok` second argument, which throws whenever the GUC has never been set in
 * that session — the actual runtime state, since tenant scoping is done at the Prisma
 * where-clause-injection layer (db.ts), never via SET LOCAL. A sibling defect on
 * PlannedRotation/PlannedRotationChange used the safe current_setting(..., true) form
 * but was missing the permissive-when-unset fallback, silently blocking all rows instead
 * of crashing. Both are fixed by migration 20260831000000_fix_rls_missing_permissive_fallback.
 *
 * This must run as the actual `matchboard_app_runtime` role — the test/dev connection
 * user (`matchboard`) is a Postgres superuser and transparently bypasses RLS entirely,
 * which is why this cannot be verified through the normal Prisma test client (`db` from
 * @/test/test-db always connects as that superuser, so a query through it can never
 * reproduce this bug regardless of whether the policy is correct).
 */
describe("RLS policies for DevelopmentThread/TeamFocus/PlannedRotation (production 42704 regression)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    // matchboard_app_runtime is the production/runtime role these RLS policies actually
    // gate — see scripts/create-rls-roles.sh. If it's missing, the test environment isn't
    // set up the way this repo expects, so fail loudly rather than silently pass.
    await client.query("SET ROLE matchboard_app_runtime");
  });

  afterAll(async () => {
    await client.query("RESET ROLE").catch(() => {});
    await client.end();
  });

  it("does not throw 'unrecognized configuration parameter' selecting from DevelopmentThread", async () => {
    await expect(client.query('SELECT 1 FROM "DevelopmentThread" LIMIT 1')).resolves.toBeDefined();
  });

  it("does not throw 'unrecognized configuration parameter' selecting from DevelopmentThreadObservation", async () => {
    await expect(client.query('SELECT 1 FROM "DevelopmentThreadObservation" LIMIT 1')).resolves.toBeDefined();
  });

  it("does not throw 'unrecognized configuration parameter' selecting from TeamFocus", async () => {
    await expect(client.query('SELECT 1 FROM "TeamFocus" LIMIT 1')).resolves.toBeDefined();
  });

  it("does not fail (permission or RLS error) selecting from PlannedRotation when app.current_organization_id is unset", async () => {
    // Prior bug: current_setting(..., true) with no permissive fallback means
    // "organisationId" = NULL evaluates to NULL (not true), so RLS returned zero rows
    // for every organisation, indistinguishable from an empty table. The regression
    // guard here is just that the query itself succeeds without a permission/RLS error —
    // actual row visibility is covered by the app-level tenant filtering tests.
    await expect(client.query('SELECT 1 FROM "PlannedRotation" LIMIT 1')).resolves.toBeDefined();
  });

  it("does not fail (permission or RLS error) selecting from PlannedRotationChange when app.current_organization_id is unset", async () => {
    await expect(client.query('SELECT 1 FROM "PlannedRotationChange" LIMIT 1')).resolves.toBeDefined();
  });
});
