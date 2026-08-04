import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setTenantOrganisationId, getTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const results: Record<string, unknown> = {};

  // Test 1: Check AsyncLocalStorage
  setTenantOrganisationId("test-org-123");
  const orgIdAfterSet = getTenantOrganisationId();
  results.asyncLocalStorageSet = orgIdAfterSet;
  results.asyncLocalStorageWorks = orgIdAfterSet === "test-org-123";

  // Test 2: Try a query through the db extension WITHOUT tenant context
  try {
    // Clear context first
    const { clearTenantOrganisationId } = await import("@/lib/tenancy/tenant-async-storage");
    clearTenantOrganisationId();

    const teamsWithoutCtx = await db.team.findMany({ take: 3 });
    results.teamsWithoutContext = {
      count: teamsWithoutCtx.length,
      names: teamsWithoutCtx.map((t: { name: string }) => t.name),
    };
  } catch (err: unknown) {
    results.teamsWithoutContextError = err instanceof Error ? err.message : String(err);
  }

  // Test 3: Try a query WITH tenant context (using enterWith)
  try {
    setTenantOrganisationId("msamadfdrf0uhjelo0czgd5omf7kyf");
    const orgIdBeforeQuery = getTenantOrganisationId();
    results.orgIdBeforeQuery = orgIdBeforeQuery;

    const teamsWithCtx = await db.team.findMany({ take: 3 });
    results.teamsWithContext = {
      count: teamsWithCtx.length,
      names: teamsWithCtx.map((t: { name: string }) => t.name),
    };
  } catch (err: unknown) {
    results.teamsWithContextError = err instanceof Error ? err.message : String(err);
  }

  // Test 4: FootballGroup with tenant context
  try {
    setTenantOrganisationId("msamadfdrf0uhjelo0czgd5omf7kyf");
    const groups = await db.footballGroup.findMany({ where: { isActive: true } });
    results.footballGroupsWithContext = {
      count: groups.length,
      names: groups.map((g: { name: string }) => g.name),
    };
  } catch (err: unknown) {
    results.footballGroupsWithContextError = err instanceof Error ? err.message : String(err);
  }

  // Test 5: Check connection info
  const dbUrl = process.env.DATABASE_URL || "not set";
  const directUrl = process.env.DIRECT_URL || "not set";
  const runtimeDirectUrl = process.env.DIRECT_RUNTIME_URL || "not set";

  results.envInfo = {
    databaseUrlHost: dbUrl.match(/@([^/]+)\//)?.[1] ?? "unknown",
    directUrlHost: directUrl === "not set" ? "not set" : (directUrl.match(/@([^/]+)\//)?.[1] ?? "unknown"),
    runtimeDirectUrlHost: runtimeDirectUrl === "not set" ? "not set" : (runtimeDirectUrl.match(/@([^/]+)\//)?.[1] ?? "unknown"),
    usesPooler: dbUrl.includes("-pooler"),
  };

  return NextResponse.json(results, { status: 200 });
}