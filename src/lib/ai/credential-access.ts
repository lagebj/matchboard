import "server-only";
import { signCredentialAccessToken } from "@/lib/ai/credential-access-token";
import { isValidAiProviderConnectionId } from "@/lib/ai/connection-id";
import { getMatchboardSecurityTransport } from "@/lib/ai/security-client/transport-factory";

/**
 * The narrow credential-access boundary required by 02_SECURITY_BOUNDARY.md: "Do not expose a
 * general-purpose `getCredential(): string` helper to the rest of the application." This module
 * is the ONLY place a raw provider credential exists in Matchboard, ever — every caller reaches
 * it exclusively through `withProviderCredential`, never a direct getter.
 *
 * The raw credential-access response parsing, the signed access token, and the credential's
 * lifetime all stay inside this module and `@/lib/ai/security-client/`, exactly as required.
 */

export class ProviderCredentialAccessError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string) {
    super(`AI provider credential access failed: ${errorCode}`);
    this.name = "ProviderCredentialAccessError";
    this.errorCode = errorCode;
  }
}

const MAX_LEAK_CHECK_DEPTH = 8;

/**
 * Defence-in-depth enforcement of "the callback return type must not be allowed to include the
 * credential" (02_SECURITY_BOUNDARY.md). TypeScript generics alone cannot statically forbid a
 * value of an arbitrary caller-chosen type `R` from containing a particular string, so this walks
 * the actual returned value at runtime and throws before it can propagate to a caller, a log
 * line, or persisted state. Bounded depth and a `seen` set make this safe against large or
 * cyclic structures.
 */
function assertNoCredentialLeak(value: unknown, credential: string, depth = 0, seen = new WeakSet<object>()): void {
  if (depth > MAX_LEAK_CHECK_DEPTH) return;

  if (typeof value === "string") {
    if (value.includes(credential)) {
      throw new Error("withProviderCredential: callback return value must not include the credential");
    }
    return;
  }

  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoCredentialLeak(item, credential, depth + 1, seen);
    }
    return;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    assertNoCredentialLeak((value as Record<string, unknown>)[key], credential, depth + 1, seen);
  }
}

/**
 * Retrieves the provider credential for `connectionId` just-in-time, passes it to `fn`, and
 * returns whatever `fn` returns — after verifying that return value does not itself contain the
 * credential. The credential exists only for the duration of this call; nothing outside `fn`'s
 * closure ever sees it.
 *
 * ```ts
 * const result = await withProviderCredential(connectionId, async (credential) => {
 *   return providerAdapter.executeReview({ credential, ...request });
 * });
 * ```
 */
export async function withProviderCredential<R>(
  connectionId: string,
  fn: (credential: string) => Promise<R>,
): Promise<R> {
  if (!isValidAiProviderConnectionId(connectionId)) {
    throw new Error(`Invalid AI provider connection ID: "${connectionId}"`);
  }

  const accessToken = await signCredentialAccessToken({ connectionId });
  const transport = getMatchboardSecurityTransport();
  const result = await transport.accessCredential({ connectionId, accessToken });

  if (!result.ok) {
    throw new ProviderCredentialAccessError(result.errorCode);
  }

  const credential = result.credential;
  const returned = await fn(credential);

  if (credential.length > 0) {
    assertNoCredentialLeak(returned, credential);
  }

  return returned;
}
