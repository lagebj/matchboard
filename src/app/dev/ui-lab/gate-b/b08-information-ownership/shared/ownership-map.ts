/**
 * B08 — information ownership verdicts, lifted verbatim from
 * `docs/ui-lab/gate-b-w5-candidates/INFORMATION_OWNERSHIP_MATRIX.md`'s own summary table. One
 * typed source every B08 candidate page reads from for its dev-only ownership annotation, so the
 * annotation can never drift from the reviewed document that justifies it.
 */
export type OwnershipVerdict = "canonical" | "contextual-preview" | "necessary-shared-identity" | "corrected-duplication";

export interface OwnershipEntry {
  topic: string;
  owner: string;
  verdict: OwnershipVerdict;
  note: string;
}

export const B08_OWNERSHIP_MAP: readonly OwnershipEntry[] = [
  {
    topic: "Match story (timeline)",
    owner: "Events tab",
    verdict: "contextual-preview",
    note: "Overview shows the same MatchTimelineList limited to 10 rows, with a real link to Events when more exist.",
  },
  {
    topic: "Goals/assists/observations counts",
    owner: "Stats tab (per-player attribution)",
    verdict: "necessary-shared-identity",
    note: "Overview's Key figures is a glanceable aggregate rollup; Stats owns per-player attribution. No name or per-player count is duplicated.",
  },
  {
    topic: "Report status + continue/view-report entry point",
    owner: "After match tab",
    verdict: "corrected-duplication",
    note: "Production AfterMatchOverview repeats the After-match tab's reflection status + CTA with no added information. B08's AFTER candidate lightens Overview's widget to a status pill + link only.",
  },
  {
    topic: "Team reflection content",
    owner: "Report Debrief tab",
    verdict: "necessary-shared-identity",
    note: "Three legitimate tiers: Debrief owns the editable source, Overview previews rating pills, After-match tab previews a single completeness word.",
  },
  {
    topic: "Coaching intent + Assistant Coach",
    owner: "AFTER Overview",
    verdict: "canonical",
    note: "Single owner — stated intent (Class 1 Fact) plus the real, unmodified CompletedMatchAdvisorPanel (Class 4 hypothesis). Not duplicated elsewhere.",
  },
  {
    topic: "What this match added",
    owner: "AFTER Overview",
    verdict: "canonical",
    note: "Single owner, gated on real computed material change. Not duplicated.",
  },
  {
    topic: "Plan vs reality / Match flow",
    owner: "AFTER Overview",
    verdict: "necessary-shared-identity",
    note: "Same canonical timeline array, materially different presentation purpose (chronological flow vs raw event list).",
  },
  {
    topic: "Final lineup (read-only)",
    owner: "AFTER Overview",
    verdict: "canonical",
    note: "Single real MatchTacticsPanel instance; Tactics tab owns only coaching-intent/format controls plus its own smaller formation summary, never the pitch renderer itself.",
  },
  {
    topic: "Report Timeline vs Match Details Events",
    owner: "Shared canonical timeline",
    verdict: "necessary-shared-identity",
    note: "Both render the literal same MatchTimelineList fed the same get-match-detail-after-data.ts read model — the match's own record and the report's reconciliation view, justified repetition.",
  },
] as const;
