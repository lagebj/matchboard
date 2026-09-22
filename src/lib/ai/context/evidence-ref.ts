import "server-only";

/**
 * Registers `ref` in `evidenceRefs` (the server-side "allowed evidence refs" set
 * `response-validation.ts`'s evidence-validation stage checks every insight's `evidenceRefs`
 * against) and returns `fact` augmented with that exact same string under an `evidenceRef` field.
 *
 * Every context builder computes its evidence-ref strings once, purely for local validation --
 * but until this helper existed, that string was never actually included in `normalizedContext`,
 * the JSON object sent to the provider as `input`. The provider was only ever shown the *shape*
 * of a valid evidence reference (the JSON Schema's `^fact:[a-z][a-z-]*:...$` regex, in
 * `contracts.ts`), never the specific strings this review's own context actually produced for it
 * to cite -- it had no way to reliably reconstruct Matchboard's internal per-category-and-suffix
 * naming convention from the regex alone. Confirmed live against Ollama Cloud (2026-09-22
 * investigation): every candidate model either invented a plausible-but-wrong evidence-ref string
 * (schema-invalid, since the invented string still had to match the regex) or gave up and
 * returned zero insights outright -- both silently indistinguishable from "the AI found nothing
 * to report." Embedding the literal ref on each fact object (so the provider can copy it
 * verbatim, per the doctrine addition in each capability's own instructions) fixed this
 * end-to-end for every model tried, including the smallest.
 *
 * Centralizing this as `evidenceRefs.add(ref)` + the embedded field in one call means the two can
 * never silently drift apart again the way they did before this fix.
 */
export function withEvidenceRef<T extends object>(evidenceRefs: Set<string>, ref: string, fact: T): T & { evidenceRef: string } {
  evidenceRefs.add(ref);
  return { ...fact, evidenceRef: ref };
}
