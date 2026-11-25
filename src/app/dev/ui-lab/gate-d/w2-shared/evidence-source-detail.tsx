import type { EvidenceRef } from "@/lib/development-context/types";
import { StatusPill } from "@/components/ui/status-pill";
import { resolveEvidenceSources, type EvidenceSourceMap, type FixtureSourceProvenance } from "./evidence-source-types";

const PROVENANCE_LABEL: Record<FixtureSourceProvenance, string> = {
  RECORDED: "Recorded fact",
  DERIVED: "Derived measurement",
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
              <StatusPill size="sm" variant={source.provenance === "RECORDED" ? "neutral" : "development"}>
                {PROVENANCE_LABEL[source.provenance]}
              </StatusPill>
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
