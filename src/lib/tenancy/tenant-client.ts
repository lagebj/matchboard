import { PrismaClient } from "@/generated/prisma/client";

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

export async function withTenantContext<T>(
  db: PrismaClient,
  organisationId: string,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  validateOrganisationId(organisationId);

  return db.$transaction(async (tx) => {
    return fn(tx as TransactionClient);
  });
}