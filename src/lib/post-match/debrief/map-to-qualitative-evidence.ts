/**
 * Deterministic debrief -> qualitative-evidence mapping (ADR-0152 §4/§4.14, bundle
 * `04_QUALITATIVE_EVIDENCE_MODEL.md` §14 "Deterministic debrief derivation"). Pure functions
 * only — no DB import — mirroring `map-to-canonical.ts`'s split between mapping and writing.
 *
 * Covers only the paths bundle §14 marks as genuinely deterministic: Worked, Needs attention,
 * the WE_CHANGED/OPPONENT_CHANGED/NO_MEANINGFUL_CHANGE/UNSURE branches of What changed, and
 * Opponent memory. BOTH_CHANGED ("one answer may need split scopes") and Anything else ("scope
 * is open-ended") are AI_STRUCTURED — a later slice queues those, not this module.
 */

import type { DebriefAnswersSection, TacticalTheme, WorkedNeedsAttentionOption } from "./v1";
import type { QualitativeEvidencePhase } from "@/generated/prisma/client";
import type { NewQualitativeObservationInput } from "@/lib/evidence/qualitative-evidence-service";

/** Mirrors the UI's own theme labels (`debrief-steps-ui.tsx`/`debrief-read-only.tsx`) for the
 * product-generated wrapper statement text — kept separate rather than imported, since those are
 * client-component files and this module must stay import-safe from a server-only writer. */
const TACTICAL_THEME_LABELS: Record<TacticalTheme, string> = {
  BUILD_UP: "Build-up",
  PROGRESSION: "Progression",
  CHANCE_CREATION: "Chance creation",
  PRESSING: "Pressing",
  DEFENSIVE_SHAPE: "Defensive shape",
  DEFENSIVE_TRANSITION: "Defensive transition",
  ATTACKING_TRANSITION: "Attacking transition",
  SET_PLAYS: "Set plays",
};

/** Bundle §10 source-fingerprint normalization: trim, CRLF -> LF, trim trailing whitespace per
 * line, preserve case/punctuation. */
export function normalizeSourceText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}

function themeObservations(
  selected: readonly WorkedNeedsAttentionOption[],
  polarity: "WORKING" | "PROBLEM",
  comment: string | undefined,
  wrapperVerb: string,
): NewQualitativeObservationInput[] {
  const themes = selected.filter((t): t is TacticalTheme => t !== "NOTHING_TO_ADD");
  const normalizedComment = normalizeSourceText(comment);
  return themes.map((theme) => ({
    scope: "TEAM",
    phase: theme as QualitativeEvidencePhase,
    polarity,
    statement: normalizedComment || `Coach marked ${TACTICAL_THEME_LABELS[theme]} as ${wrapperVerb}.`,
  }));
}

export function buildWorkedObservations(answers: DebriefAnswersSection): NewQualitativeObservationInput[] {
  return themeObservations(answers.worked.selected, "WORKING", answers.worked.comment, "working");
}

export function buildNeedsAttentionObservations(answers: DebriefAnswersSection): NewQualitativeObservationInput[] {
  return themeObservations(answers.needs_attention.selected, "PROBLEM", answers.needs_attention.comment, "needing attention");
}

/**
 * BOTH_CHANGED is deliberately excluded here (AI_STRUCTURED, bundle §14) — a later slice queues
 * it. The debrief's free-text `period` (a display label, not the `MatchPeriod` enum — see
 * `v1.ts`'s own doc comment on why it's a free string) has no safe generic mapping to
 * `MatchPeriod` for every match format, so it is intentionally not carried onto the observation's
 * `period` field; the coach's own wording already carries it in `statement`.
 */
export function buildChangeObservations(answers: DebriefAnswersSection): NewQualitativeObservationInput[] {
  const change = answers.match_changes;
  if (!change) return [];

  const statement = normalizeSourceText(change.description);

  switch (change.option) {
    case "WE_CHANGED":
      return statement ? [{ scope: "TEAM", phase: "GENERAL", polarity: "NEUTRAL", statement }] : [];
    case "OPPONENT_CHANGED":
      return statement ? [{ scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement }] : [];
    case "NO_MEANINGFUL_CHANGE":
    case "UNSURE":
    case "BOTH_CHANGED":
      return [];
  }
}

export function buildOpponentMemoryObservations(answers: DebriefAnswersSection): NewQualitativeObservationInput[] {
  const statement = normalizeSourceText(answers.opponent_memory.note);
  return statement ? [{ scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement }] : [];
}

/** The fingerprint payload for each source type — bundle §10: every structured field that
 * changes the derived claims, nothing else. `debriefVersion` is `DEBRIEF_SCHEMA_VERSION`, not the
 * `PostMatchDebrief.version` row-level counter — a schema version bump is exactly the kind of
 * change that must invalidate every prior fingerprint for this source. */
export function workedFingerprint(answers: DebriefAnswersSection, debriefSchemaVersion: number) {
  return { debriefSchemaVersion, selected: [...answers.worked.selected].sort(), comment: normalizeSourceText(answers.worked.comment) };
}

export function needsAttentionFingerprint(answers: DebriefAnswersSection, debriefSchemaVersion: number) {
  return { debriefSchemaVersion, selected: [...answers.needs_attention.selected].sort(), comment: normalizeSourceText(answers.needs_attention.comment) };
}

export function changeFingerprint(answers: DebriefAnswersSection, debriefSchemaVersion: number) {
  const change = answers.match_changes;
  return { debriefSchemaVersion, option: change?.option ?? null, description: normalizeSourceText(change?.description), period: change?.period ?? null };
}

export function opponentMemoryFingerprint(answers: DebriefAnswersSection, debriefSchemaVersion: number) {
  return { debriefSchemaVersion, note: normalizeSourceText(answers.opponent_memory.note) };
}
