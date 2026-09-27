import type { ReactNode } from "react";
import {
  TEAM_EXECUTION_ROWS,
  type DebriefAnswersSection,
  type TeamExecutionRow,
  type TeamExecutionValue,
  type WorkedNeedsAttentionOption,
  type MatchChangeOption,
} from "@/lib/post-match/debrief/v1";
import { getObservationLabel, type FootballObservationCode } from "@/lib/evidence/observation-vocabulary";

const TEAM_EXECUTION_ROW_LABELS: Record<TeamExecutionRow, string> = {
  effort: "Effort",
  teamCohesion: "Team cohesion",
  positionalShape: "Positional shape",
  recoveryBehavior: "Recovery after losing the ball",
};

const TEAM_EXECUTION_VALUE_LABELS: Record<TeamExecutionValue, string> = {
  STRONG: "Strong",
  OK: "OK",
  NEEDS_ATTENTION: "Needs attention",
  NOT_OBSERVED: "Not observed",
};

const THEME_LABELS: Record<WorkedNeedsAttentionOption, string> = {
  BUILD_UP: "Build-up",
  PROGRESSION: "Progression",
  CHANCE_CREATION: "Chance creation",
  PRESSING: "Pressing",
  DEFENSIVE_SHAPE: "Defensive shape",
  DEFENSIVE_TRANSITION: "Defensive transition",
  ATTACKING_TRANSITION: "Attacking transition",
  SET_PLAYS: "Set plays",
  NOTHING_TO_ADD: "Nothing to add",
};

const MATCH_CHANGE_LABELS: Record<MatchChangeOption, string> = {
  NO_MEANINGFUL_CHANGE: "No meaningful change",
  WE_CHANGED: "We changed something",
  OPPONENT_CHANGED: "The opponent changed something",
  BOTH_CHANGED: "Both teams changed",
  UNSURE: "Not sure",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      <div className="text-[13px] text-[var(--foreground)]">{children}</div>
    </div>
  );
}

/**
 * Bundle §11 "Completed view" — read-only, hides empty optional sections, and renders
 * `NOT_OBSERVED`/no-evidence choices as muted neutral text rather than anything resembling a
 * negative score.
 */
export function DebriefReadOnly({ answers, opponentName }: { answers: DebriefAnswersSection; opponentName: string }) {
  const hasWorked = answers.worked.selected.length > 0;
  const hasNeedsAttention = answers.needs_attention.selected.length > 0;
  const hasOpponentMemory = !!answers.opponent_memory.note;
  const hasPlayerObservations = answers.player_observations.length > 0;
  const hasAnythingElse = !!answers.anything_else.note;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Team execution</h3>
        {TEAM_EXECUTION_ROWS.map((row) => {
          const answer = answers.team_execution[row];
          return (
            <Field key={row} label={TEAM_EXECUTION_ROW_LABELS[row]}>
              <span className={!answer || answer.value === "NOT_OBSERVED" ? "text-[var(--text-muted)]" : undefined}>
                {answer ? TEAM_EXECUTION_VALUE_LABELS[answer.value] : "Not observed"}
              </span>
            </Field>
          );
        })}
        {answers.team_execution.note && <Field label="Team note">{answers.team_execution.note}</Field>}
      </div>

      {hasWorked && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">What worked</h3>
          <p className="text-[13px] text-[var(--foreground)]">{answers.worked.selected.map((t) => THEME_LABELS[t]).join(", ")}</p>
          {answers.worked.comment && <p className="text-[13px] text-[var(--text-soft)]">{answers.worked.comment}</p>}
        </div>
      )}

      {hasNeedsAttention && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">What needs attention</h3>
          <p className="text-[13px] text-[var(--foreground)]">{answers.needs_attention.selected.map((t) => THEME_LABELS[t]).join(", ")}</p>
          {answers.needs_attention.comment && <p className="text-[13px] text-[var(--text-soft)]">{answers.needs_attention.comment}</p>}
        </div>
      )}

      {answers.match_changes && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">What changed</h3>
          <p className="text-[13px] text-[var(--foreground)]">{MATCH_CHANGE_LABELS[answers.match_changes.option]}</p>
          {answers.match_changes.description && <p className="text-[13px] text-[var(--text-soft)]">{answers.match_changes.description}</p>}
        </div>
      )}

      {hasOpponentMemory && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Opponent memory — {opponentName}</h3>
          <p className="text-[13px] text-[var(--foreground)]">{answers.opponent_memory.note}</p>
        </div>
      )}

      {hasPlayerObservations && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Player observations</h3>
          <ul className="flex flex-col gap-1.5">
            {answers.player_observations.map((obs, index) => (
              <li key={`${obs.playerId}-${index}`} className="text-[13px] text-[var(--foreground)]">
                {getObservationLabel(obs.observationCode as FootballObservationCode, obs.direction)}
                {obs.note && <span className="text-[var(--text-soft)]"> — {obs.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasAnythingElse && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Anything else</h3>
          <p className="text-[13px] text-[var(--foreground)]">{answers.anything_else.note}</p>
        </div>
      )}
    </div>
  );
}
