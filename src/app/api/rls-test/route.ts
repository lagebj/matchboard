import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setTenantOrganisationId, clearTenantOrganisationId, getTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const results: Record<string, unknown> = {};

  // Test 0: Connection info from env
  const dbUrl = process.env.DATABASE_URL || "not set";
  const directUrl = process.env.DIRECT_URL || "not set";
  const runtimeDirectUrl = process.env.DIRECT_RUNTIME_URL || "not set";

  // Compute runtimeDirectUrl same way as db.ts
  const connectionString = process.env.DATABASE_URL!;
  const computedRuntimeUrl = connectionString.includes("-pooler.")
    ? connectionString.replace("-pooler.", ".")
    : connectionString;

  results.envInfo = {
    databaseUrlHost: dbUrl.match(/@([^/]+)\//)?.[1] ?? "unknown",
    directUrlHost: directUrl === "not set" ? "not set" : (directUrl.match(/@([^/]+)\//)?.[1] ?? "unknown"),
    computedRuntimeUrlHost: computedRuntimeUrl.match(/@([^/]+)\//)?.[1] ?? "unknown",
    runtimeDirectUrlEnv: runtimeDirectUrl === "not set" ? "not set" : (runtimeDirectUrl.match(/@([^/]+)\//)?.[1] ?? "unknown"),
    usesPooler: dbUrl.includes("-pooler"),
    poolerStripped: computedRuntimeUrl.includes("-pooler"),
  };

  // Test 1: Raw SQL with SET LOCAL — does RLS actually work through this adapter?
  clearTenantOrganisationId();
  try {
    const rawResult = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = 'msamadfdrf0uhjelo0czgd5omf7ky'`);
      const currentSetting = await tx.$queryRawUnsafe(`SHOW app.current_organization_id`);
      const teams = await tx.$queryRawUnsafe(`SELECT id, name FROM "Team" LIMIT 5`);
      return { currentSetting, teams };
    });
    results.rawSqlWithSetLocal = {
      currentSetting: rawResult.currentSetting,
      teamCount: Array.isArray(rawResult.teams) ? rawResult.teams.length : "not array",
      teamNames: Array.isArray(rawResult.teams) ? rawResult.teams.map((r: Record<string, unknown>) => r.name) : rawResult.teams,
    };
  } catch (err: unknown) {
    results.rawSqlWithSetLocalError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }

  // Test 2: AsyncLocalStorage inside $transaction callback
  setTenantOrganisationId("msamadfdrf0uhjelo0czgd5omf7kyf");
  try {
    const insideResult = await db.$transaction(async (tx) => {
      const orgIdInside = getTenantOrganisationId();
      await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${orgIdInside}'`);
      const currentSetting = await tx.$queryRawUnsafe(`SHOW app.current_organization_id`);
      const teams = await tx.$queryRawUnsafe(`SELECT id, name FROM "Team" LIMIT 5`);
      return { orgIdInside, currentSetting, teamCount: Array.isArray(teams) ? teams.length : "not array", teamNames: Array.isArray(teams) ? teams.map((r: Record<string, unknown>) => r.name) : teams };
    });
    results.asyncLocalStorageInTransaction = insideResult;
  } catch (err: unknown) {
    results.asyncLocalStorageInTransactionError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }

  // Test 3: Prisma model query with RLS extension
  setTenantOrganisationId("msamadfdrf0uhjelo0czgd5omf7kyf");
  try {
    const teamsWithCtx = await db.team.findMany({ take: 5 });
    results.prismaExtensionQuery = {
      orgIdBeforeQuery: getTenantOrganisationId(),
      count: teamsWithCtx.length,
      names: teamsWithCtx.map((t: { name: string }) => t.name),
    };
  } catch (err: unknown) {
    results.prismaExtensionQueryError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }

  // Test 4: Without any tenant context (should return 0 for RLS tables)
  clearTenantOrganisationId();
  try {
    const teamsNoCtx = await db.team.findMany({ take: 5 });
    results.noContextQuery = {
      count: teamsNoCtx.length,
      names: teamsNoCtx.map((t: { name: string }) => t.name),
    };
  } catch (err: unknown) {
    results.noContextQueryError = err instanceof Error ? err.message : String(err);
  }

  // Test 5: Organisation table (no RLS) — should always return data
  clearTenantOrganisationId();
  try {
    const orgs = await db.organisation.findMany({ take: 3 });
    results.organisationQuery = {
      count: orgs.length,
      names: orgs.map((o: { name: string }) => o.name),
    };
  } catch (err: unknown) {
    results.organisationQueryError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(results, { status: 200 });
}