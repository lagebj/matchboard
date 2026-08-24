import { PrismaClient } from "@/generated/prisma/client";
import { runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const MAX_ORGANISATION_ID_LENGTH = 64;
const ORGANISATION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidOrganisationId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= MAX_ORGANISATION_ID_LENGTH && ORGANISATION_ID_PATTERN.test(id);
}

function validateOrganisationId(organisationId: string): string {
  if (!isValidOrganisationId(organisationId)) {
    throw new Error(`Invalid organisationId for tenant context: ${organisationId}`);
  }
  return organisationId;
}

/**
 * Runs `fn` inside a transaction AND inside AsyncLocalStorage tenant context scoped to
 * `organisationId` (ADR-0087) — so the `tenantRLS` extension (src/lib/db.ts) auto-injects
 * `organisationId` into every RLS-scoped query `fn` makes, exactly like an ordinary
 * `requireActorContext()`-resolved request. Before ADR-0087 this helper only wrapped the
 * transaction and never actually set tenant context, despite its name — every caller was
 * relying on its own explicit `where: { organisationId }` clause for scoping, and any query
 * that omitted one (e.g. `getEffectiveGroupAccess()`'s `groupAccess.findMany({ where: {
 * membershipId } })`) ran fully unscoped. Fixing this one function closes that gap for every
 * caller at once instead of patching each call site's ordering individually.
 */
export async function withTenantContext<T>(
  db: PrismaClient,
  organisationId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  validateOrganisationId(organisationId);

  // Must `await` inside the runWithTenantOrganisationId callback, not just return the promise:
  // Prisma queries/transactions are lazy (they don't actually dispatch until awaited), and
  // AsyncLocalStorage context set by `.run()` is only visible to work that happens within its
  // callback's own continuation — returning an un-awaited promise lets the caller's later
  // `await` trigger the real dispatch *after* the context has already reverted.
  return runWithTenantOrganisationId(organisationId, async () => {
    return await db.$transaction(async (tx) => {
      return fn(tx as TransactionClient);
    });
  });
}