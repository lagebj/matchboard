import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * Mirrors `src/components/players/player-assessment-history-panel.tsx`'s real presentation
 * (same labels, same layout) over fixture-supplied data, rather than mounting that component
 * directly — it owns its own internal `fetch("/api/players/[playerId]/assessment-history")`
 * call, so a UI Lab fixture cannot pass it data as props without either monkey-patching the
 * network layer or diverging from its real behavior. This is the same "reproduce the real
 * rendering block over fixture input" strategy D02's `evidence-groups.tsx` already uses for the
 * Evidence tab's grouped-rendering block — not a new pattern. See `DATA_TRUTH_AND_FIXTURES.md`
 * for the disclosure.
 */
export type AssessmentChangeEntry = {
  id: string;
  targetType: string;
  attributeKey: string | null;
  targetDescription: string | null;
  beforeValue: number | null;
  afterValue: number | null;
  source: string;
  reason: string | null;
  confidence: number | null;
  createdAt: string;
};

const SOURCE_LABELS: Record<string, string> = {
  AUTOMATIC: "Evidence engine",
  MANUAL_EDIT: "Coach edit",
  MIGRATION: "Migration",
  REBASE: "Manual rebase",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  ATTRIBUTE: "Attribute",
  GOALKEEPER: "Goalkeeper",
  POSITION: "Position",
};

export function AssessmentHistoryDisplay({ changes }: { changes: AssessmentChangeEntry[] }) {
  return (
    <Surface>
      <div className="p-4">
        <SectionHeader title="Assessment history" description="Attribute changes recorded by the evidence engine or coach." />
        {changes.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] mt-2">No assessment changes recorded.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {changes.map((change) => (
              <div key={change.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {change.attributeKey ?? TARGET_TYPE_LABELS[change.targetType] ?? change.targetType}
                  </span>
                  {change.targetDescription && (
                    <span className="text-xs text-[var(--text-muted)]">{change.targetDescription}</span>
                  )}
                  {change.reason && <span className="text-xs text-[var(--text-muted)]">{change.reason}</span>}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-sm">
                    {change.beforeValue !== null ? Number(change.beforeValue).toFixed(0) : "—"} →{" "}
                    {change.afterValue !== null ? Number(change.afterValue).toFixed(0) : "—"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{SOURCE_LABELS[change.source] ?? change.source}</span>
                  <span className="text-xs text-[var(--text-muted)]">{new Date(change.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
}
