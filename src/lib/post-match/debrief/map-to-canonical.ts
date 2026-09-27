/**
 * Deterministic debrief -> canonical mapping (ADR-0152 §3/§4.14, bundle §07.10 "Debrief
 * canonical mapping transaction"). Pure functions only — no DB import — so the mapping itself is
 * unit-testable without a database. `service.ts` calls these and performs the actual writes
 * inside one transaction.
 */

import type { DebriefAnswersSection, TeamExecutionRow } from "./v1";
import { TEAM_EXECUTION_ROWS } from "./v1";

/** `TeamReflection`'s existing rating vocabulary — `NOT_OBSERVED` maps to `null` on the
 * canonical model while remaining present in the debrief JSON (bundle §00 Decision 10 / §04.4). */
export type CanonicalTeamReflectionRating = "STRONG" | "OK" | "NEEDS_ATTENTION" | null;

export type TeamReflectionMapping = {
  effort: CanonicalTeamReflectionRating;
  teamCohesion: CanonicalTeamReflectionRating;
  positionalShape: CanonicalTeamReflectionRating;
  recoveryBehavior: CanonicalTeamReflectionRating;
  note: string | null;
};

export function mapTeamExecutionToTeamReflection(answers: DebriefAnswersSection): TeamReflectionMapping {
  const mapped: Record<TeamExecutionRow, CanonicalTeamReflectionRating> = {} as never;
  for (const row of TEAM_EXECUTION_ROWS) {
    const value = answers.team_execution[row]?.value;
    mapped[row] = value && value !== "NOT_OBSERVED" ? value : null;
  }
  return {
    ...mapped,
    note: answers.team_execution.note?.trim() || null,
  };
}

/**
 * Opponent memory free text, non-destructively merged with any existing factual summary
 * (bundle §03.6: "Do not silently overwrite existing distinct text"). Identical text is a
 * no-op; distinct existing text is preserved by appending the new note rather than replacing
 * it. Returns `null` when there is nothing to write (never writes an empty string).
 */
export function mapOpponentMemory(answers: DebriefAnswersSection, existingFactualSummary: string | null): string | null {
  const note = answers.opponent_memory.note?.trim();
  if (!note) return existingFactualSummary;
  if (!existingFactualSummary) return note;
  if (existingFactualSummary.trim() === note) return existingFactualSummary;
  if (existingFactualSummary.includes(note)) return existingFactualSummary;
  return `${existingFactualSummary}\n\n${note}`;
}

export type ReportTeamNoteSource = "anything_else";

/** "Anything else" maps directly to `PostMatchReport.teamNote` / the Event equivalent — a plain
 * overwrite is correct here (unlike opponent memory) because this field's only normal writer is
 * now the debrief itself; the coach edits or confirms the prefilled legacy value in place. */
export function mapAnythingElseToReportNote(answers: DebriefAnswersSection): string | null {
  return answers.anything_else.note?.trim() || null;
}

export type MappedPlayerObservation = {
  playerId: string;
  observationCode: string;
  direction: "POSITIVE" | "NEGATIVE";
  note: string | null;
};

export function mapPlayerObservations(answers: DebriefAnswersSection): MappedPlayerObservation[] {
  return answers.player_observations.map((o) => ({
    playerId: o.playerId,
    observationCode: o.observationCode,
    direction: o.direction,
    note: o.note?.trim() || null,
  }));
}
