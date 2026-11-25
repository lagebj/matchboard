import type { EvidenceRef } from "@/lib/development-context/types";

/**
 * Gate D Wave 2 (D03/D06) — fixture-only source records behind an `EvidenceRef`. Production's
 * `EvidenceRef` (`src/lib/development-context/types.ts`) is intentionally a reference by
 * `{kind, id, occurredAt?, label?}` only — it has no URL/route field, and
 * `AssistantCoachHypothesisPanel` renders it as a plain text label, never a link (confirmed by
 * direct inspection: no navigable source-detail capability exists in production today). D06's
 * register acceptance question requires a "source-linked story", so Wave 2 fixtures carry a
 * parallel, richer `FixtureSourceRecord` per cited ref id and present it through
 * `EvidenceSourceInspector` — a disclosed UI Lab directional presentation, never a claim that
 * this resolution mechanism exists in production.
 *
 * `provenance` mirrors ADR-0155/ADR-0157's knowledge-hierarchy classes A ("RECORDED" — direct
 * facts and observations) and B ("DERIVED" — deterministic measurements/trends) only. A source
 * record is never itself class C (coach assessment) or D (AI hypothesis) — that distinction is
 * exactly what keeps a cited source from acquiring the hypothesis's own uncertainty.
 */
export type FixtureSourceProvenance = "RECORDED" | "DERIVED";

export type FixtureSourceRecord = {
  id: string;
  kind: EvidenceRef["kind"];
  label: string;
  occurredAt?: string;
  /** The recorded or derived content itself — e.g. the observation's own text, or a trend's
   * stated construct/time periods/baseline/units/sample. Never an AI assertion. */
  detail: string;
  provenance: FixtureSourceProvenance;
  /** Explicit coverage/uncertainty disclosure for this one source, e.g. "6 of 6 eligible
   * matches" or "Single observation, not a trend". */
  coverage: string;
};

export type EvidenceSourceMap = Record<string, FixtureSourceRecord>;

/**
 * Resolves one `EvidenceRef` to its fixture source record, failing loudly rather than silently
 * rendering a label with nothing behind it. A Wave 2 fixture that cites a ref id with no
 * registered source record, or whose source record's kind disagrees with the ref's own declared
 * kind, is a fixture-integrity bug — exactly the "plausible-looking source label without a
 * corresponding source record" the mission brief prohibits.
 */
export function resolveEvidenceSource(ref: EvidenceRef, sources: EvidenceSourceMap): FixtureSourceRecord {
  const source = sources[ref.id];
  if (!source) {
    throw new Error(`Gate D W2 fixture integrity: no source record registered for evidence ref id "${ref.id}".`);
  }
  if (source.kind !== ref.kind) {
    throw new Error(
      `Gate D W2 fixture integrity: evidence ref "${ref.id}" declares kind "${ref.kind}" but its source record is "${source.kind}".`,
    );
  }
  return source;
}

export function resolveEvidenceSources(refs: EvidenceRef[], sources: EvidenceSourceMap): FixtureSourceRecord[] {
  return refs.map((ref) => resolveEvidenceSource(ref, sources));
}
