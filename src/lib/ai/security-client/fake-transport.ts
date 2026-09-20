import type {
  MatchboardSecurityTransport,
  AccessCredentialResult,
  DeleteConnectionResult,
} from "@/lib/ai/security-client/transport";
import type { AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * In-memory fake matchboard-security transport for tests and local development without a real
 * deployment (per the bundle's own test doctrine — "Add E2E coverage... using fake security/
 * provider transports. Never use a real provider credential in CI."). Mirrors
 * `src/lib/email/fake-provider.ts`'s shape: seed known connections, capture calls, force
 * failures on demand.
 */
export class FakeMatchboardSecurityTransport implements MatchboardSecurityTransport {
  readonly name = "fake";
  readonly accessCredentialCalls: { connectionId: string; accessToken: string }[] = [];
  readonly deleteConnectionCalls: { connectionId: string; provider: AiProviderWireId; deleteToken: string }[] = [];

  private credentials = new Map<string, string>();
  private forcedAccessFailure: string | null = null;
  private forcedDeleteFailure: string | null = null;

  /** Registers a connection ID as having a stored credential, as if enrollment had already
   * completed against the real service. */
  seedCredential(connectionId: string, credential: string): void {
    this.credentials.set(connectionId, credential);
  }

  forceNextAccessFailure(errorCode: string): void {
    this.forcedAccessFailure = errorCode;
  }

  forceNextDeleteFailure(errorCode: string): void {
    this.forcedDeleteFailure = errorCode;
  }

  async accessCredential(params: { connectionId: string; accessToken: string }): Promise<AccessCredentialResult> {
    this.accessCredentialCalls.push(params);

    if (this.forcedAccessFailure) {
      const errorCode = this.forcedAccessFailure;
      this.forcedAccessFailure = null;
      return { ok: false, errorCode };
    }

    const credential = this.credentials.get(params.connectionId);
    if (credential === undefined) {
      return { ok: false, errorCode: "CONNECTION_NOT_FOUND" };
    }

    return { ok: true, credential };
  }

  async deleteConnection(params: {
    connectionId: string;
    provider: AiProviderWireId;
    deleteToken: string;
  }): Promise<DeleteConnectionResult> {
    this.deleteConnectionCalls.push(params);

    if (this.forcedDeleteFailure) {
      const errorCode = this.forcedDeleteFailure;
      this.forcedDeleteFailure = null;
      return { ok: false, errorCode };
    }

    const existed = this.credentials.delete(params.connectionId);
    return { ok: true, status: existed ? "deleted" : "not_found" };
  }
}
