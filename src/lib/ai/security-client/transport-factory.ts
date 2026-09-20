import "server-only";
import type { MatchboardSecurityTransport } from "@/lib/ai/security-client/transport";
import { ScalewaySecurityTransport } from "@/lib/ai/security-client/scaleway-transport";
import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";
import { isAiSecurityBoundaryConfigured } from "@/lib/ai/config";
import { isTest } from "@/lib/env";

/**
 * Mirrors `src/lib/email/provider-factory.ts`: a lazily-created singleton, resettable/
 * injectable for tests. Always the fake transport under the test runner, regardless of whether
 * `AI_*` env vars happen to be set — this repo's test doctrine (09_TEST_AND_ACCEPTANCE.md) is
 * explicit that CI must never hold a real provider/security credential.
 */
let transportInstance: MatchboardSecurityTransport | null = null;

export function getMatchboardSecurityTransport(): MatchboardSecurityTransport {
  if (transportInstance) return transportInstance;

  transportInstance =
    !isTest() && isAiSecurityBoundaryConfigured() ? new ScalewaySecurityTransport() : new FakeMatchboardSecurityTransport();

  return transportInstance;
}

export function resetMatchboardSecurityTransport(): void {
  transportInstance = null;
}

export function setMatchboardSecurityTransport(transport: MatchboardSecurityTransport): void {
  transportInstance = transport;
}
