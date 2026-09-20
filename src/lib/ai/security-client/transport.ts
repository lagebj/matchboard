import type { AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * The matchboard-security HTTP client interface (02_SECURITY_BOUNDARY.md /
 * 02A_MATCHBOARD_SECURITY_REQUIRED_DELTA.md), mirroring the shape already established by
 * `src/lib/email/provider.ts` for an outbound third-party client: an interface, a real
 * implementation, a fake implementation, and a factory that switches between them.
 *
 * Two operations only — matchboard-security is credential custody only, never a place Matchboard
 * calls to construct prompts, run providers, or persist anything:
 * - `accessCredential`: the private, server-to-server `/v1/credentials/access` call.
 * - `deleteConnection`: the public `/v1/connections/delete` call (02A §3) — defined here for
 *   interface completeness/stability; no application code calls it yet (wired to the disconnect
 *   lifecycle in a later PR).
 *
 * Neither operation is ever given the actual provider credential to send — enrollment (which
 * *does* carry the credential) is submitted browser-direct and never touches Matchboard's server
 * at all, so no transport method for it exists here.
 */

export type AccessCredentialResult =
  | { ok: true; credential: string }
  | { ok: false; errorCode: string };

export type DeleteConnectionResult =
  | { ok: true; status: "deleted" | "not_found" }
  | { ok: false; errorCode: string };

export interface MatchboardSecurityTransport {
  readonly name: string;

  /** Calls `POST {runtimeUrl}/v1/credentials/access`. `accessToken` is an already-signed,
   * short-lived credential-access JWT (see `@/lib/ai/credential-access-token.ts`) — this
   * transport never signs anything itself. */
  accessCredential(params: { connectionId: string; accessToken: string }): Promise<AccessCredentialResult>;

  /** Calls `POST {enrollmentUrl}/v1/connections/delete`. `deleteToken` is an already-signed,
   * short-lived delete-connection JWT (see `@/lib/ai/enrollment-token.ts`). */
  deleteConnection(params: {
    connectionId: string;
    provider: AiProviderWireId;
    deleteToken: string;
  }): Promise<DeleteConnectionResult>;
}
