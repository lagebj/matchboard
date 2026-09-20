import "server-only";
import { db } from "@/lib/db";
import { Prisma, type AiProviderConnection } from "@/generated/prisma/client";
import { generateAiProviderConnectionId, isValidAiProviderConnectionId } from "@/lib/ai/connection-id";
import { toPrismaAiProviderId, type AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * Data access for `AiProviderConnection` (ADR-0148 / 04_ORG_CONNECTION_FLOW.md). Every read is
 * explicitly scoped by `organisationId` in its own `where` clause — not relying solely on the
 * `tenantRLS` Prisma extension's implicit where-clause injection — because a wrong connection ID
 * belonging to a different organisation must come back as "not found," never leak any field of
 * another organisation's row (acceptance gate #8).
 */

const MAX_CREATE_ATTEMPTS = 3;

export async function createPendingProviderConnection(params: {
  organisationId: string;
  provider: AiProviderWireId;
  createdByUserId: string;
}): Promise<AiProviderConnection> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    // >=128-bit CSPRNG (generateAiProviderConnectionId) makes a collision with an existing ID
    // astronomically unlikely, but the ID is application-assigned, not DB-assigned, so a
    // defensive retry on a unique-constraint violation costs nothing.
    const id = generateAiProviderConnectionId();
    try {
      return await db.aiProviderConnection.create({
        data: {
          id,
          organisationId: params.organisationId,
          provider: toPrismaAiProviderId(params.provider),
          createdByUserId: params.createdByUserId,
        },
      });
    } catch (error) {
      lastError = error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create AI provider connection after multiple attempts");
}

/** Returns null for a connection ID that doesn't exist, is malformed, or belongs to a different
 * organisation — callers must not distinguish these cases in any response to the browser. */
export async function getProviderConnection(
  organisationId: string,
  connectionId: string,
): Promise<AiProviderConnection | null> {
  if (!isValidAiProviderConnectionId(connectionId)) {
    return null;
  }
  return db.aiProviderConnection.findFirst({
    where: { id: connectionId, organisationId },
  });
}
