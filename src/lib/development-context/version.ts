import { createHash } from "node:crypto";

/**
 * Stable `inputRevision` hashing (ADR-0155 §6, source bundle §04's "Input revision"). Same
 * inputs + same algorithm version must yield the same revision — this module is the one place
 * that canonicalizes a measurement's inputs before hashing, so no derivation service reimplements
 * its own ordering/stringify convention.
 *
 * Canonicalization: object keys are sorted recursively. Arrays of primitives (string/number/
 * boolean/null) are also sorted, so hashing the same logical input assembled from a differently-
 * ordered source query never changes the result. Arrays of objects preserve their given order —
 * order across heterogeneous/object items is not generically sortable here, so a caller whose
 * array order is not meaningful must normalize it before calling.
 *
 * `computedAt` (or any other non-canonical field) is never special-cased here — callers must
 * simply never include it in the object passed to `computeInputRevision`. Hashing exactly what
 * it is given, with no implicit exclusions, keeps this module's contract unambiguous.
 */

type Primitive = string | number | boolean | null;

function isPrimitive(value: unknown): value is Primitive {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function comparePrimitives(a: Primitive, b: Primitive): number {
  if (a === b) return 0;
  const left = String(a);
  const right = String(b);
  return left < right ? -1 : 1;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    if (items.every(isPrimitive)) {
      return [...(items as Primitive[])].sort(comparePrimitives);
    }
    return items;
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(value[key]);
    }
    return result;
  }
  return value;
}

/** Deterministic JSON representation: sorted object keys, sorted primitive arrays. */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** SHA-256 of the canonical JSON representation of `input`. Omit `computedAt` from `input`. */
export function computeInputRevision(input: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJsonStringify(input)).digest("hex");
}
