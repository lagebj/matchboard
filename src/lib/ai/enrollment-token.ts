import "server-only";
import { signAiSecurityBoundaryToken } from "@/lib/ai/jwt-signing";
import { getAiEnrollmentSigningPrivateKeyB64 } from "@/lib/ai/config";
import { isValidAiProviderConnectionId } from "@/lib/ai/connection-id";
import { isAiProviderWireId, type AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * Enrollment-signing-keypair tokens (02_SECURITY_BOUNDARY.md / 02A_MATCHBOARD_SECURITY_REQUIRED_DELTA.md).
 * Both operations below share the same keypair and audience — matchboard-security's public
 * enrollment service is the target for both browser-direct credential enrollment and
 * server-to-server connection deletion.
 */

const ENROLLMENT_AUDIENCE = "matchboard-ai-enrollment";

function assertValidConnectionAndProvider(connectionId: string, provider: AiProviderWireId): void {
  if (!isValidAiProviderConnectionId(connectionId)) {
    throw new Error(`Invalid AI provider connection ID: "${connectionId}"`);
  }
  if (!isAiProviderWireId(provider)) {
    throw new Error(`Invalid AI provider ID: "${provider}"`);
  }
}

/**
 * Signs the short-lived token the browser presents to `POST {enrollmentUrl}/v1/connections`
 * when submitting a provider credential directly (never through a Matchboard API route).
 */
export async function signEnrollmentToken(params: {
  connectionId: string;
  provider: AiProviderWireId;
}): Promise<string> {
  assertValidConnectionAndProvider(params.connectionId, params.provider);

  return signAiSecurityBoundaryToken({
    privateKeyPkcs8Base64: getAiEnrollmentSigningPrivateKeyB64(),
    audience: ENROLLMENT_AUDIENCE,
    claims: {
      op: "enroll-connection",
      connectionId: params.connectionId,
      provider: params.provider,
    },
  });
}

/**
 * Signs the short-lived token Matchboard's server sends to
 * `POST {enrollmentUrl}/v1/connections/delete` to delete a stored credential without ever
 * reading it (02A_MATCHBOARD_SECURITY_REQUIRED_DELTA.md §3).
 */
export async function signDeleteConnectionToken(params: {
  connectionId: string;
  provider: AiProviderWireId;
}): Promise<string> {
  assertValidConnectionAndProvider(params.connectionId, params.provider);

  return signAiSecurityBoundaryToken({
    privateKeyPkcs8Base64: getAiEnrollmentSigningPrivateKeyB64(),
    audience: ENROLLMENT_AUDIENCE,
    claims: {
      op: "delete-connection",
      connectionId: params.connectionId,
      provider: params.provider,
    },
  });
}
