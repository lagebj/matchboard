import "server-only";
import { createHash } from "node:crypto";

/**
 * Source-fingerprint computation (07_EXECUTION_PIPELINE.md "Source fingerprint"). A review is
 * reused — never re-run — as long as its source fingerprint is unchanged
 * (01_LOCKED_DECISIONS.md: "AI results are persisted and reused until relevant source state
 * changes").
 *
 * This module's job is purely mechanical: stable-serialize an already-normalized context object
 * and SHA-256 it. "Build the normalized context, strip UI-only fields, sort unordered
 * collections" is each capability's own `context/*.ts` builder's responsibility (a later PR) —
 * by the time a context object reaches `computeSourceFingerprint()`, it must already be fully
 * normalized. The one thing this module still cannot assume the caller got right is object *key*
 * order (which carries no meaning in JS/JSON and is easy to introduce unintentionally, e.g. by
 * spreading two objects in a different order in two code paths that should fingerprint
 * identically) — so this stably sorts keys at every level before hashing, on top of whatever
 * array/field normalization the caller already did.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Recursively sorts object keys (arrays are left in the order the caller already normalized —
 * this function does not know which arrays are semantically unordered and which order matters). */
function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const sorted: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/** Deterministic JSON serialization: stable key order at every nesting level, no whitespace. */
export function stableSerialize(value: JsonValue): string {
  return JSON.stringify(sortKeysDeep(value));
}

/** Computes the hex-encoded SHA-256 `sourceFingerprint` for an already-normalized context
 * object. Same normalized context in, same fingerprint out — always, deterministically. */
export function computeSourceFingerprint(normalizedContext: JsonValue): string {
  return createHash("sha256").update(stableSerialize(normalizedContext), "utf8").digest("hex");
}
