import { signAiSecurityBoundaryToken } from "@/lib/ai/jwt-signing";
import { getAiCredentialAccessSigningPrivateKeyB64 } from "@/lib/ai/config";
import { isValidAiProviderConnectionId } from "@/lib/ai/connection-id";

/**
 * Credential-access-signing-keypair token (02_SECURITY_BOUNDARY.md). Matchboard's server signs
 * this immediately before calling matchboard-security's private
 * `POST {runtimeUrl}/v1/credentials/access`, bound to exactly one connection ID. This module is
 * intentionally the only place this keypair is used — see `withProviderCredential` (a later PR)
 * for the narrow boundary that consumes the returned credential.
 */

const CREDENTIAL_ACCESS_AUDIENCE = "matchboard-ai-credentials";

export async function signCredentialAccessToken(params: { connectionId: string }): Promise<string> {
  if (!isValidAiProviderConnectionId(params.connectionId)) {
    throw new Error(`Invalid AI provider connection ID: "${params.connectionId}"`);
  }

  return signAiSecurityBoundaryToken({
    privateKeyPkcs8Base64: getAiCredentialAccessSigningPrivateKeyB64(),
    audience: CREDENTIAL_ACCESS_AUDIENCE,
    claims: {
      op: "access-credential",
      connectionId: params.connectionId,
    },
  });
}
