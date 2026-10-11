import { StatusPill } from "@/components/ui/status-pill";
import type { ExtractionObservation } from "@/lib/evidence/qualitative-evidence-extraction-contract";

/**
 * A11 "coach text → parsed evidence" presentation (register row 38: "AI parsing not AI
 * inference; source lineage, independence"). Reuses the REAL `ExtractionObservation` type and
 * vocabulary from `src/lib/evidence/qualitative-evidence-extraction-contract.ts` for fidelity —
 * that module is pure (zod schemas + string constants, no `server-only` tag), so importing its
 * TYPES here does not pull any server/db code into this dev-only client component. The actual
 * extraction CALL is never made; every fixture's observations are pre-validated against the real
 * schema in its own `fixtures.ts`, never invented ad hoc.
 */

const POLARITY_LABEL: Record<string, string> = {
  WORKING: "Working well",
  PROBLEM: "Problem",
  NEUTRAL: "Neutral",
  UNCERTAIN: "Uncertain",
};

export function CoachNoteCard({ authorLabel, occurredAtLabel, text }: { authorLabel: string; occurredAtLabel: string; text: string }) {
  return (
    <div className="rounded-[var(--tl-radius-widget)] border border-[var(--border-soft)] bg-[var(--tl-widget)] p-4">
      <div className="flex items-center justify-between gap-2">
        <StatusPill size="sm" variant="neutral">
          Coach-authored observation
        </StatusPill>
        <span className="text-[11px] text-[var(--text-muted)]">{occurredAtLabel}</span>
      </div>
      <p className="mt-2 text-sm text-[var(--foreground)]">&ldquo;{text}&rdquo;</p>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">— {authorLabel}, original wording preserved, immutable in its historical record.</p>
    </div>
  );
}

export function ExtractedObservationCard({ observation, playerNameByRef }: { observation: ExtractionObservation; playerNameByRef: Record<string, string> }) {
  const subjectLabel =
    observation.scope === "PLAYER" || observation.scope === "PAIR"
      ? [observation.playerRef, observation.secondaryPlayerRef].filter((r): r is string => Boolean(r)).map((r) => playerNameByRef[r] ?? r).join(" & ")
      : observation.scope === "OPPONENT"
        ? "Opponent"
        : "Team";

  return (
    <div data-testid="extracted-observation-card" className="rounded-lg border border-[var(--border-soft)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill size="sm" variant={observation.explicitness === "EXPLICIT" ? "info" : "neutral"}>
          {observation.explicitness === "EXPLICIT" ? "Explicit claim" : "Tentative claim"}
        </StatusPill>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{subjectLabel}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{observation.phase.replaceAll("_", " ").toLowerCase()}</span>
      </div>
      <p className="mt-1.5 text-[13px] text-[var(--foreground)]">{observation.statement}</p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">Polarity: {POLARITY_LABEL[observation.polarity] ?? observation.polarity}</p>
    </div>
  );
}

export function NoObservationsNotice() {
  return (
    <p data-testid="no-observations-notice" className="text-[13px] text-[var(--text-muted)]">
      No verifiable claims were extracted from this note — producing no observations is a correct result, not an error.
    </p>
  );
}
