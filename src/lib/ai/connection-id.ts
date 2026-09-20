/**
 * AiProviderConnection ID minting and validation (01_LOCKED_DECISIONS.md / ADR-0148).
 *
 * Deliberately not a `cuid()` — this ID is minted by application code (not the database) and
 * shared verbatim with the external matchboard-security enrollment flow, so both sides must
 * agree on its exact string before the corresponding `AiProviderConnection` row necessarily
 * exists. >=128-bit CSPRNG, URL-safe encoded, per the locked decision.
 */

const CONNECTION_ID_PREFIX = "aic_";

// 20 random bytes (160 bits) base64url-encodes to 27 chars with no padding — comfortably above
// the >=128-bit requirement while staying URL-safe with no `=`/`+`/`/` characters to escape.
const CONNECTION_ID_RANDOM_BYTES = 20;

const CONNECTION_ID_PATTERN = /^aic_[A-Za-z0-9_-]{20,64}$/;

export function generateAiProviderConnectionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CONNECTION_ID_RANDOM_BYTES));
  return `${CONNECTION_ID_PREFIX}${Buffer.from(bytes).toString("base64url")}`;
}

export function isValidAiProviderConnectionId(value: string): boolean {
  return CONNECTION_ID_PATTERN.test(value);
}
