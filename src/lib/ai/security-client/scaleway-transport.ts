import type {
  MatchboardSecurityTransport,
  AccessCredentialResult,
  DeleteConnectionResult,
} from "@/lib/ai/security-client/transport";
import { getAiSecurityRuntimeUrl, getAiSecurityEnrollmentUrl, getAiSecurityFunctionToken } from "@/lib/ai/config";
import type { AiProviderWireId } from "@/lib/ai/provider-registry";
import { logger } from "@/lib/logger";

/**
 * Real HTTP client for matchboard-security's private credential-access function and public
 * connection-delete endpoint. Mirrors `src/lib/email/brevo-provider.ts`'s shape for an outbound
 * third-party client.
 *
 * Hard security requirements (ADR-0148 / 02_SECURITY_BOUNDARY.md), enforced here and nowhere
 * else in the request path:
 * - `redirect: "manual"` — a request carrying a signed authorization token (and, on the
 *   credential-access path, receiving a raw provider credential back) must never silently follow
 *   a redirect to a different host.
 * - Every failure path returns a normalized `errorCode`, never the raw response body, raw
 *   headers, or the exception's own message (which could echo request content back).
 * - Nothing here is ever logged except the normalized error code and, where safe, the connection
 *   ID (opaque, non-secret) — never the credential, never a signed token, never a raw body.
 *
 * The exact success-response JSON shape for both endpoints is not pinned down byte-for-byte by
 * the implementation bundle (`02_SECURITY_BOUNDARY.md` documents the enrollment response
 * precisely but not these two) — `{ credential: string }` and `{ status: "deleted" | "not_found" }`
 * are this implementation's best-faith reading of the bundle's prose ("receives the provider
 * credential" / "return normalized success/not-found state only"). This is exactly the kind of
 * assumption ADR-0148 flags as needing verification against a real matchboard-security deployment
 * before production go-live — see its "Risks and mitigations" section.
 */
export class ScalewaySecurityTransport implements MatchboardSecurityTransport {
  readonly name = "scaleway";

  async accessCredential(params: { connectionId: string; accessToken: string }): Promise<AccessCredentialResult> {
    const url = `${trimTrailingSlash(getAiSecurityRuntimeUrl())}/v1/credentials/access`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": getAiSecurityFunctionToken(),
          Authorization: `Bearer ${params.accessToken}`,
        },
        body: JSON.stringify({ connectionId: params.connectionId }),
      });
    } catch {
      logSafeFailure("accessCredential", params.connectionId, "NETWORK_ERROR");
      return { ok: false, errorCode: "NETWORK_ERROR" };
    }

    if (response.type === "opaqueredirect") {
      logSafeFailure("accessCredential", params.connectionId, "REDIRECT_BLOCKED");
      return { ok: false, errorCode: "REDIRECT_BLOCKED" };
    }

    if (!response.ok) {
      logSafeFailure("accessCredential", params.connectionId, `HTTP_${response.status}`);
      return { ok: false, errorCode: `HTTP_${response.status}` };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      logSafeFailure("accessCredential", params.connectionId, "INVALID_RESPONSE_SHAPE");
      return { ok: false, errorCode: "INVALID_RESPONSE_SHAPE" };
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("credential" in body) ||
      typeof (body as { credential: unknown }).credential !== "string" ||
      (body as { credential: string }).credential.length === 0
    ) {
      logSafeFailure("accessCredential", params.connectionId, "INVALID_RESPONSE_SHAPE");
      return { ok: false, errorCode: "INVALID_RESPONSE_SHAPE" };
    }

    return { ok: true, credential: (body as { credential: string }).credential };
  }

  async deleteConnection(params: {
    connectionId: string;
    provider: AiProviderWireId;
    deleteToken: string;
  }): Promise<DeleteConnectionResult> {
    const url = `${trimTrailingSlash(getAiSecurityEnrollmentUrl())}/v1/connections/delete`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.deleteToken}`,
        },
        body: JSON.stringify({ connectionId: params.connectionId, provider: params.provider }),
      });
    } catch {
      logSafeFailure("deleteConnection", params.connectionId, "NETWORK_ERROR");
      return { ok: false, errorCode: "NETWORK_ERROR" };
    }

    if (response.type === "opaqueredirect") {
      logSafeFailure("deleteConnection", params.connectionId, "REDIRECT_BLOCKED");
      return { ok: false, errorCode: "REDIRECT_BLOCKED" };
    }

    // Treat delete as idempotent per 02A §3: a 404 is a successful "already gone" outcome, not
    // an error, matching "treat already-missing secret as idempotent successful deletion".
    if (response.status === 404) {
      return { ok: true, status: "not_found" };
    }

    if (!response.ok) {
      logSafeFailure("deleteConnection", params.connectionId, `HTTP_${response.status}`);
      return { ok: false, errorCode: `HTTP_${response.status}` };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      logSafeFailure("deleteConnection", params.connectionId, "INVALID_RESPONSE_SHAPE");
      return { ok: false, errorCode: "INVALID_RESPONSE_SHAPE" };
    }

    const status = typeof body === "object" && body !== null ? (body as { status?: unknown }).status : undefined;
    if (status === "deleted" || status === "not_found") {
      return { ok: true, status };
    }

    logSafeFailure("deleteConnection", params.connectionId, "INVALID_RESPONSE_SHAPE");
    return { ok: false, errorCode: "INVALID_RESPONSE_SHAPE" };
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function logSafeFailure(operation: string, connectionId: string, errorCode: string): void {
  logger.warn({ operation, connectionId, errorCode }, "[ai/security-client] matchboard-security call failed");
}
