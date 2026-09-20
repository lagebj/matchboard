import { isProduction } from "@/lib/env";

/**
 * Server-only environment access for the AI Advisor credential security boundary (ADR-0148).
 *
 * These variables authenticate Matchboard to the separate `matchboard-security` service and are
 * never read anywhere except inside the narrow signing/credential-access boundary modules in
 * this directory. None of them gate application startup today (`validateEnv()` in `src/lib/env.ts`
 * does not require them) — the AI Advisor feature has no live code path yet, so requiring them in
 * production before there is anything to configure them for would only break unrelated deploys.
 * Each getter throws on first actual use instead, matching the existing `getAuthSecret()` /
 * `getLiveMatchRealtimeSecret()` convention. Revisit once a real caller exists (delivery phase 5).
 *
 * Deliberately no `import "server-only"` guard: this module follows the same convention already
 * established by `src/lib/env.ts` and `src/lib/machine-principal/machine-token.ts` for
 * secret-reading/signing utilities in this codebase — never imported by any `"use client"` module
 * (enforced by review + `npm run architecture:check`, which does not itself key off the
 * `server-only` marker), and kept directly unit-testable, which the marker package's throwing
 * `default` export condition otherwise prevents under this repo's Vitest setup. Adaptation
 * documented per the implementation bundle's own change-control rule.
 */

function requireAiEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set.`);
  }
  return value;
}

/** Base64-encoded Ed25519 PKCS#8 private key used to sign short-lived browser enrollment
 * authorizations (and connection-delete authorizations, which reuse the same keypair). */
export function getAiEnrollmentSigningPrivateKeyB64(): string {
  return requireAiEnvVar("AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64");
}

/** Base64-encoded Ed25519 PKCS#8 private key used to sign short-lived credential-access
 * authorizations sent to matchboard-security's private runtime function. */
export function getAiCredentialAccessSigningPrivateKeyB64(): string {
  return requireAiEnvVar("AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64");
}

/** Scaleway private Function Secret Key for the matchboard-ai-client-prod IAM app. Sent only as
 * the `X-Auth-Token` header on the private credential-access call — never exposed to the browser. */
export function getAiSecurityFunctionToken(): string {
  return requireAiEnvVar("AI_SECURITY_FUNCTION_TOKEN");
}

/** Public matchboard-security enrollment service base URL. */
export function getAiSecurityEnrollmentUrl(): string {
  return requireAiEnvVar("AI_SECURITY_ENROLLMENT_URL");
}

/** Private matchboard-security credential-access service base URL. */
export function getAiSecurityRuntimeUrl(): string {
  return requireAiEnvVar("AI_SECURITY_RUNTIME_URL");
}

/**
 * Development-only local/self-hosted Ollama override for developer testing. Never an
 * organisation-configured setting — production Ollama support is Ollama Cloud only
 * (03_PROVIDER_ADAPTERS_AND_MODELS.md). Hard-rejected here even if somehow set in production, as
 * defence in depth alongside the equivalent `validateEnv()` production check in `src/lib/env.ts`.
 */
export function getAiOllamaDevBaseUrl(): string | undefined {
  const value = process.env.AI_OLLAMA_DEV_BASE_URL;
  if (!value) {
    return undefined;
  }
  if (isProduction()) {
    throw new Error(
      "AI_OLLAMA_DEV_BASE_URL must not be set in production. Production Ollama support is Ollama Cloud only.",
    );
  }
  return value;
}

/** Whether every environment variable the matchboard-security integration needs is present.
 * Does not validate the values are well-formed or that the service is reachable — only that the
 * feature is configured enough to attempt real (non-fake-transport) operation. */
export function isAiSecurityBoundaryConfigured(): boolean {
  return Boolean(
    process.env.AI_ENROLLMENT_SIGNING_PRIVATE_KEY_B64 &&
      process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 &&
      process.env.AI_SECURITY_FUNCTION_TOKEN &&
      process.env.AI_SECURITY_ENROLLMENT_URL &&
      process.env.AI_SECURITY_RUNTIME_URL,
  );
}
