import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

export const MACHINE_SCOPES = [
  "scenario:read",
  "scenario:execute",
  "scenario:reset-own-data",
  "ui:simulate",
  "fixtures:read",
  "players:read",
  "teams:read",
  "selections:read",
  "selections:write",
] as const;

export type MachineScope = (typeof MACHINE_SCOPES)[number];

const FORBIDDEN_SCOPES = [
  "organisation:admin",
  "organisation:create",
  "user:impersonate",
  "billing:read",
  "billing:write",
  "data:export:parent",
  "data:read:cross-tenant",
] as const;

export const CLIENT_SECRET_BYTES = 32;
export const CLIENT_SECRET_PREFIX_LENGTH = 8;
export const TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes
export const TOKEN_MIN_AGE_SECONDS = 5 * 60; // 5 minutes
export const DEFAULT_TOKEN_AGE_SECONDS = 10 * 60; // 10 minutes

export function isValidScope(scope: string): scope is MachineScope {
  return (MACHINE_SCOPES as readonly string[]).includes(scope);
}

export function isForbiddenScope(scope: string): boolean {
  return (FORBIDDEN_SCOPES as readonly string[]).includes(scope);
}

export function validateScopes(scopes: string[]): { valid: MachineScope[]; invalid: string[] } {
  const valid: MachineScope[] = [];
  const invalid: string[] = [];

  for (const scope of scopes) {
    if (isForbiddenScope(scope)) {
      invalid.push(scope);
    } else if (isValidScope(scope)) {
      valid.push(scope);
    } else {
      invalid.push(scope);
    }
  }

  return { valid, invalid };
}

export function hashClientSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateClientSecret(): string {
  return randomBytes(CLIENT_SECRET_BYTES).toString("base64url");
}

export function extractClientSecretPrefix(secret: string): string {
  return secret.substring(0, CLIENT_SECRET_PREFIX_LENGTH);
}

export function verifyClientSecret(secret: string, hash: string): boolean {
  const computedHash = hashClientSecret(secret);
  return computedHash === hash;
}

export interface CreateMachinePrincipalInput {
  organisationId: string;
  name: string;
  description?: string;
  scopes: string[];
}

export interface CreateMachinePrincipalResult {
  principal: {
    id: string;
    organisationId: string;
    name: string;
    description: string | null;
    scopes: string[];
    status: string;
    clientCredentialPrefix: string | null;
    createdAt: Date;
  };
  clientSecret: string;
}

export async function createMachinePrincipal(
  input: CreateMachinePrincipalInput,
  client: PrismaClient = db,
): Promise<CreateMachinePrincipalResult> {
  const { valid, invalid } = validateScopes(input.scopes);

  if (invalid.length > 0) {
    throw new Error(`Invalid or forbidden scopes: ${invalid.join(", ")}`);
  }

  if (valid.length === 0) {
    throw new Error("At least one valid scope is required");
  }

  const clientSecret = generateClientSecret();
  const clientSecretHash = hashClientSecret(clientSecret);
  const clientCredentialPrefix = extractClientSecretPrefix(clientSecret);

  const principal = await client.machinePrincipal.create({
    data: {
      organisationId: input.organisationId,
      name: input.name,
      description: input.description ?? null,
      scopes: valid,
      status: "ACTIVE",
      clientCredentialHash: clientSecretHash,
      clientCredentialPrefix: clientCredentialPrefix,
    },
    select: {
      id: true,
      organisationId: true,
      name: true,
      description: true,
      scopes: true,
      status: true,
      clientCredentialPrefix: true,
      createdAt: true,
    },
  });

  return {
    principal,
    clientSecret,
  };
}

export async function revokeMachinePrincipal(
  principalId: string,
  client: PrismaClient = db,
): Promise<void> {
  const principal = await client.machinePrincipal.findUnique({
    where: { id: principalId },
    select: { status: true },
  });

  if (!principal) {
    throw new Error(`Machine principal not found: ${principalId}`);
  }

  if (principal.status === "REVOKED") {
    return;
  }

  await client.machinePrincipal.update({
    where: { id: principalId },
    data: { status: "REVOKED" },
  });
}

export async function reactivateMachinePrincipal(
  principalId: string,
  client: PrismaClient = db,
): Promise<void> {
  const principal = await client.machinePrincipal.findUnique({
    where: { id: principalId },
    select: { status: true },
  });

  if (!principal) {
    throw new Error(`Machine principal not found: ${principalId}`);
  }

  if (principal.status === "ACTIVE") {
    return;
  }

  await client.machinePrincipal.update({
    where: { id: principalId },
    data: { status: "ACTIVE" },
  });
}

export async function authenticateMachinePrincipal(
  principalId: string,
  clientSecret: string,
  requestedScopes: string[],
  client: PrismaClient = db,
): Promise<{
  authenticated: boolean;
  principal?: {
    id: string;
    organisationId: string;
    scopes: string[];
    status: string;
  };
  grantedScopes?: string[];
  reason?: string;
}> {
  const principal = await client.machinePrincipal.findUnique({
    where: { id: principalId },
    select: {
      id: true,
      organisationId: true,
      scopes: true,
      status: true,
      clientCredentialHash: true,
    },
  });

  if (!principal) {
    return { authenticated: false, reason: "Principal not found" };
  }

  if (principal.status === "REVOKED") {
    return { authenticated: false, reason: "Principal revoked" };
  }

  if (!principal.clientCredentialHash || !verifyClientSecret(clientSecret, principal.clientCredentialHash)) {
    return { authenticated: false, reason: "Invalid client secret" };
  }

  const { valid: requestedValid } = validateScopes(requestedScopes);
  const grantedScopes = requestedValid.filter((s) =>
    (principal.scopes as string[]).includes(s),
  );

  if (grantedScopes.length === 0 && requestedScopes.length > 0) {
    return { authenticated: false, reason: "No requested scopes are allowed for this principal" };
  }

  await client.machinePrincipal.update({
    where: { id: principalId },
    data: { lastUsedAt: new Date() },
  });

  return {
    authenticated: true,
    principal: {
      id: principal.id,
      organisationId: principal.organisationId,
      scopes: principal.scopes as string[],
      status: principal.status,
    },
    grantedScopes,
  };
}

export async function getMachinePrincipalsForOrganisation(
  organisationId: string,
  client: PrismaClient = db,
): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    scopes: string[];
    status: string;
    clientCredentialPrefix: string | null;
    lastUsedAt: Date | null;
    createdAt: Date;
  }>
> {
  return client.machinePrincipal.findMany({
    where: { organisationId },
    select: {
      id: true,
      name: true,
      description: true,
      scopes: true,
      status: true,
      clientCredentialPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function rotateClientSecret(
  principalId: string,
  client: PrismaClient = db,
): Promise<{ clientSecret: string; clientCredentialPrefix: string }> {
  const principal = await client.machinePrincipal.findUnique({
    where: { id: principalId },
    select: { status: true },
  });

  if (!principal) {
    throw new Error(`Machine principal not found: ${principalId}`);
  }

  if (principal.status === "REVOKED") {
    throw new Error("Cannot rotate client secret for revoked principal");
  }

  const newSecret = generateClientSecret();
  const newHash = hashClientSecret(newSecret);
  const newPrefix = extractClientSecretPrefix(newSecret);

  await client.machinePrincipal.update({
    where: { id: principalId },
    data: {
      clientCredentialHash: newHash,
      clientCredentialPrefix: newPrefix,
    },
  });

  return { clientSecret: newSecret, clientCredentialPrefix: newPrefix };
}