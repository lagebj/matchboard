import { StatusPill } from "@/components/ui/status-pill";

/**
 * Gate D Wave 2 — the honest "no defensible conclusion" state the mission brief requires (D03
 * §6/§11, D06 §7/§9). Production's `AssistantCoachHypothesisPanel` returns `null` whenever its
 * `hypotheses` array is empty (confirmed: `assistant-coach-hypothesis-panel.tsx` line 84) — this
 * collapses "AI disabled", "no hypothesis currently active", and "evidence too sparse to support
 * one" into literal silence, with no distinguishing message anywhere in that data path. This
 * component is a disclosed directional presentation for the one case Wave 2 is scoped to — sparse
 * evidence — never a claim that production distinguishes these states today. It never invents a
 * negative assessment to fill the space (XR-A04's reject case: "unsupported story headline").
 */
export function NoDefensibleHypothesis({
  coachQuestion,
  insufficiencySummary,
  availableFacts,
}: {
  /** The open coaching question evidence cannot yet answer (XR-A04: "display the coaching
   * question and available facts with an honest insufficiency state"). */
  coachQuestion: string;
  insufficiencySummary: string;
  availableFacts: string[];
}) {
  return (
    <div className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill size="sm" variant="neutral">
          Assistant Coach
        </StatusPill>
        <span className="text-[11px] text-[var(--text-muted)]">No defensible hypothesis</span>
      </div>
      <p className="mt-2 text-sm text-[var(--foreground)]">{coachQuestion}</p>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">{insufficiencySummary}</p>
      {availableFacts.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-[11px] text-[var(--text-muted)]">
          {availableFacts.map((fact) => (
            <li key={fact}>&bull; {fact}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] italic text-[var(--text-muted)]">
        Assistant Coach does not have enough comparable evidence yet to propose a defensible development hypothesis, and will
        not generate one just to fill this space.
      </p>
    </div>
  );
}
