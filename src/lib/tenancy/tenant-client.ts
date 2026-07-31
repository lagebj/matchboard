import { PrismaClient } from "@/generated/prisma/client";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const MAX_ORGANISATION_ID_LENGTH = 64;
const ORGANISATION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface TenantContext {
  organisationId: string;
  db: PrismaClient;
}

export function isValidOrganisationId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= MAX_ORGANISATION_ID_LENGTH && ORGANISATION_ID_PATTERN.test(id);
}

function validateOrganisationId(organisationId: string): string {
  if (!isValidOrganisationId(organisationId)) {
    throw new Error(`Invalid organisationId for tenant context: ${organisationId}`);
  }
  return organisationId;
}

// SET LOCAL is a session configuration command, not a data query.
// Prisma's tagged template $executeRaw does not support parameterised values
// in SET commands (PostgreSQL syntax error at "$1"). Using $executeRawUnsafe
// is safe here because: (1) the organisationId is validated against a strict
// alphanumeric pattern that prevents SQL injection; (2) this is a
// transaction-scoped configuration command, not a data query; (3) the value
// comes from authenticated user membership resolution, not client input.
export async function setTenantContext(
  tx: TransactionClient,
  organisationId: string,
): Promise<void> {
  const validatedId = validateOrganisationId(organisationId);
  await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${validatedId}'`);
}

export async function withTenantContext<T>(
  db: PrismaClient,
  organisationId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  const validatedId = validateOrganisationId(organisationId);

  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${validatedId}'`);
    return fn(tx as TransactionClient);
  });
}

export async function withUnscopedContext<T>(
  db: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = ''`);
    return fn(tx as TransactionClient);
  });
}

export async function clearTenantContext(
  tx: TransactionClient,
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = ''`);
}

export function createTenantContext(organisationId: string, db: PrismaClient): TenantContext {
  validateOrganisationId(organisationId);
  return { organisationId, db };
}