import { verifyMachineToken, type MachineTokenPayload } from "@/lib/machine-principal/machine-token";
import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

export interface MachineAuthResult {
  authenticated: true;
  principal: {
    id: string;
    organisationId: string;
    scopes: string[];
    status: string;
  };
  token: MachineTokenPayload;
}

export interface MachineAuthFailure {
  authenticated: false;
  reason: string;
}

export type MachineAuthOutcome = MachineAuthResult | MachineAuthFailure;

export async function authenticateWithBearerToken(
  authorizationHeader: string | null,
  client: PrismaClient = db,
): Promise<MachineAuthOutcome> {
  if (!authorizationHeader) {
    return { authenticated: false, reason: "No Authorization header" };
  }

  const parts = authorizationHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return { authenticated: false, reason: "Invalid Authorization header format" };
  }

  const token = parts[1];

  let payload: MachineTokenPayload;
  try {
    payload = await verifyMachineToken(token);
  } catch {
    return { authenticated: false, reason: "Invalid or expired token" };
  }

  const principal = await client.machinePrincipal.findUnique({
    where: { id: payload.principalId },
    select: {
      id: true,
      organisationId: true,
      scopes: true,
      status: true,
    },
  });

  if (!principal) {
    return { authenticated: false, reason: "Principal not found" };
  }

  if (principal.status === "REVOKED") {
    return { authenticated: false, reason: "Principal revoked" };
  }

  if (principal.organisationId !== payload.organisationId) {
    return { authenticated: false, reason: "Organisation mismatch" };
  }

  return {
    authenticated: true,
    principal: {
      id: principal.id,
      organisationId: principal.organisationId,
      scopes: principal.scopes as string[],
      status: principal.status,
    },
    token: payload,
  };
}

export function hasScope(authResult: MachineAuthResult, scope: string): boolean {
  return authResult.principal.scopes.includes(scope);
}

export function hasAnyScope(authResult: MachineAuthResult, scopes: string[]): boolean {
  return scopes.some((scope) => authResult.principal.scopes.includes(scope));
}

export function hasAllScopes(authResult: MachineAuthResult, scopes: string[]): boolean {
  return scopes.every((scope) => authResult.principal.scopes.includes(scope));
}