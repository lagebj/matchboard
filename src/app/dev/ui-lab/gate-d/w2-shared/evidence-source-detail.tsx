import type { EvidenceRef } from "@/lib/development-context/types";
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill";
import { resolveEvidenceSources, type EvidenceSourceMap } from "./evidence-source-types";

/**
 * Remediation (owner review of PR #847): the pill label was previously derived from
 * `FixtureSourceProvenance` ("Recorded fact" / "Derived measurement") — correct for a canonical
 * record but wrong for a `HUMAN_ASSESSMENT` or `QUALITATIVE_OBSERVATION`, both of which are
 * `provenance: "RECORDED"` (the fixture didn't compute them) while still being a coach's own
 * judgment, not an objective fact (ADR-0155/ADR-0157's knowledge-hierarchy classes A vs. C). A
 * coach assessment labelled "Recorded fact" risks reading as objectively established. The label
 * is now derived from `EvidenceRef.kind` directly, never from `provenance` — `provenance` still
 * describes how the fixture obtained the record (kept on `FixtureSourceRecord` for that reason,
 * see `evidence-source-types.ts`), not what kind of claim its content makes.
 */
const KIND_LABEL: Record<EvidenceRef["kind"], string> = {
  MATCH_EVENT: "Recorded match event",
  ACTUAL_POSITION_INTERVAL: "Recorded position",
  QUALITATIVE_OBSERVATION: "Coach observation",
  HUMAN_ASSESSMENT: "Coach assessment",
  MATCH_CONTEXT: "Recorded match context",
  DERIVED_MEASUREMENT: "Derived measurement",
  DERIVED_TREND: "Derived trend",
};

/** Three-tier visual grouping matching ADR-0155/ADR-0157's own classes: canonical fact (A),
 * coach judgment (C), derived measurement (B) — never a fourth tier here, since a source record
 * is never itself an AI hypothesis (class D). */
const KIND_PILL_VARIANT: Record<EvidenceRef["kind"], StatusPillVariant> = {
  MATCH_EVENT: "neutral",
  ACTUAL_POSITION_INTERVAL: "neutral",
  MATCH_CONTEXT: "neutral",
  QUALITATIVE_OBSERVATION: "info",
  HUMAN_ASSESSMENT: "info",
  DERIVED_MEASUREMENT: "development",
  DERIVED_TREND: "development",
};

/**
 * Gate D Wave 2 — a disclosed directional "source inspection" presentation. Production's
 * `AssistantCoachHypothesisPanel` cites evidence as a plain inline text label only (confirmed: no
 * navigable source-detail capability exists today). This component sits alongside the real,
 * unmodified panel — never inside it — and resolves each cited `EvidenceRef` to its fixture
 * source record via `resolveEvidenceSource`, so every rendered source is provably backed by a
 * real record rather than a plausible-looking label. Native `<details>/<summary>` keeps expand/
 * collapse keyboard-accessible with no custom JS.
 */
export function EvidenceSourceInspector({
  title,
  refs,
  sources,
}: {
  title: string;
  refs: EvidenceRef[];
  sources: EvidenceSourceMap;
}) {
  if (refs.length === 0) return null;
  const resolved = resolveEvidenceSources(refs, sources);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</p>
      {resolved.map((source) => (
        <details key={source.id} className="rounded-md border border-[var(--border-soft)] bg-[var(--tl-widget)] p-2">
          <summary className="cursor-pointer text-[12px] font-medium text-[var(--foreground)]">{source.label}</summary>
          <div className="mt-2 flex flex-col gap-1.5 text-[11px] text-[var(--text-muted)]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill size="sm" variant={KIND_PILL_VARIANT[source.kind]}>{KIND_LABEL[source.kind]}</StatusPill>
              {source.occurredAt ? <span>{source.occurredAt}</span> : null}
            </div>
            <p className="text-[var(--foreground)]">{source.detail}</p>
            <p className="italic">Coverage: {source.coverage}</p>
          </div>
        </details>
      ))}
      <p className="text-[10px] italic text-[var(--text-muted)]">
        UI Lab directional presentation — production currently cites evidence as a text label only, with no navigable source
        detail. This inspector is not a production capability.
      </p>
    </div>
  );
}
