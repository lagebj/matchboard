import type { CoachSituationProjection } from "@/lib/situational/situation-types";

/**
 * Situational summary for the opponent detail page's combination evidence (LONG_TERM candidate
 * provider, docs/domain/situational-decision-support.md). Server-rendered alongside
 * `OpponentCombinationEvidenceSection` -- proves the projection infrastructure is reused a third
 * time beyond Today and Opportunity Gap, on a page with no Matchday/Next operational meaning of
 * its own. The candidate/decision itself never carries a player's name (AGENTS.md: "Resolve
 * names for display only") -- names are resolved here from the caller's own already-loaded map.
 */
export function OpponentCombinationSituationalSummary({
  projection,
  playerNameById,
}: {
  projection: CoachSituationProjection;
  playerNameById: Record<string, string>;
}) {
  if (projection.decisions.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">Situational summary</p>
      <ul className="mt-2 flex flex-col gap-1">
        {projection.decisions.map((decision) => {
          const names = decision.affectedEntities
            .filter((e) => e.entityType === "PLAYER")
            .map((e) => playerNameById[e.entityId] ?? "Unknown player")
            .join(" & ");
          return (
            <li key={decision.id} className="text-xs text-zinc-400">
              {names ? <span className="text-zinc-300">{names}</span> : null}
              {names ? " — " : ""}
              {decision.summary}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
