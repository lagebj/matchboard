"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import {
  TEAM_EXECUTION_ROWS,
  TEAM_EXECUTION_VALUES,
  WORKED_NEEDS_ATTENTION_OPTIONS,
  MAX_THEME_SELECTIONS,
  MATCH_CHANGE_OPTIONS,
  MAX_PLAYER_OBSERVATIONS,
  type DebriefAnswersSection,
  type TeamExecutionRow,
  type TeamExecutionValue,
  type WorkedNeedsAttentionOption,
  type MatchChangeOption,
} from "@/lib/post-match/debrief/v1";
import { ALL_OBSERVATION_CODES, getObservationLabel, type FootballObservationCode, type ObservationPolarity } from "@/lib/evidence/observation-vocabulary";

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

const MATCH_CHANGE_REQUIRES_TEXT: readonly MatchChangeOption[] = ["WE_CHANGED", "OPPONENT_CHANGED", "BOTH_CHANGED"];

/** Shared chip toggle — 44px minimum touch target (frontend-ui-engineering skill), not the
 * smaller chip sizing the retired standalone team-reflection form used. */
function Chip({
  label,
  selected,
  onClick,
  tone = "neutral",
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  tone?: "positive" | "attention" | "soft" | "neutral";
}) {
  const selectedClasses: Record<typeof tone, string> = {
    positive: "bg-[var(--success-subtle)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_35%,transparent)]",
    attention: "bg-[var(--warning-subtle)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_35%,transparent)]",
    soft: "bg-[var(--tl-c-surface-selected)] text-[var(--text-muted)] border-[var(--border-strong)]",
    neutral: "bg-[var(--tl-c-surface-selected)] text-[var(--foreground)] border-[var(--border-strong)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-11 rounded-[var(--tl-c-radius-control)] border px-3 py-2 text-[13px] font-medium transition-colors",
        selected ? selectedClasses[tone] : "bg-[var(--tl-c-surface)] text-[var(--text-muted)] border-[var(--border-soft)] hover:bg-[var(--tl-c-surface-hover)]",
      )}
    >
      {label}
    </button>
  );
}

function LongTextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-[var(--text-muted)]">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={2000}
        className="min-h-[88px] rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)]"
      />
    </div>
  );
}

export function TeamExecutionStep({ value, onChange }: { value: DebriefAnswersSection["team_execution"]; onChange: (next: DebriefAnswersSection["team_execution"]) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-[var(--text-soft)]">Choose one answer for each. Do not rate something you did not observe.</p>
      {TEAM_EXECUTION_ROWS.map((row) => (
        <div key={row} className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-[var(--foreground)]">{TEAM_EXECUTION_ROW_LABELS[row]}</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={TEAM_EXECUTION_ROW_LABELS[row]}>
            {TEAM_EXECUTION_VALUES.map((option) => {
              const selected = value[row]?.value === option;
              const tone = option === "STRONG" ? "positive" : option === "NEEDS_ATTENTION" ? "attention" : option === "NOT_OBSERVED" ? "soft" : "neutral";
              return (
                <Chip
                  key={option}
                  label={`${TEAM_EXECUTION_ROW_LABELS[row]}: ${TEAM_EXECUTION_VALUE_LABELS[option]}`}
                  selected={selected}
                  tone={tone}
                  onClick={() => onChange({ ...value, [row]: { value: option } })}
                />
              );
            })}
          </div>
        </div>
      ))}
      <LongTextField label="Team note · optional" value={value.note ?? ""} onChange={(note) => onChange({ ...value, note: note || undefined })} placeholder="Optional team-level reflection notes…" />
    </div>
  );
}

export function ThemeSelectionStep({
  value,
  onChange,
  commentLabel,
}: {
  value: DebriefAnswersSection["worked"];
  onChange: (next: DebriefAnswersSection["worked"]) => void;
  commentLabel: string;
}) {
  function toggle(option: WorkedNeedsAttentionOption) {
    const selected = value.selected;
    if (option === "NOTHING_TO_ADD") {
      onChange({ ...value, selected: selected.includes("NOTHING_TO_ADD") ? [] : ["NOTHING_TO_ADD"] });
      return;
    }
    const withoutNothingToAdd = selected.filter((s) => s !== "NOTHING_TO_ADD");
    if (withoutNothingToAdd.includes(option)) {
      onChange({ ...value, selected: withoutNothingToAdd.filter((s) => s !== option) });
      return;
    }
    if (withoutNothingToAdd.length >= MAX_THEME_SELECTIONS) return;
    onChange({ ...value, selected: [...withoutNothingToAdd, option] });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[var(--text-soft)]">Select up to {MAX_THEME_SELECTIONS} areas.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {WORKED_NEEDS_ATTENTION_OPTIONS.map((option) => (
          <Chip key={option} label={THEME_LABELS[option]} selected={value.selected.includes(option)} onClick={() => toggle(option)} />
        ))}
      </div>
      <LongTextField label={`${commentLabel} · optional`} value={value.comment ?? ""} onChange={(comment) => onChange({ ...value, comment: comment || undefined })} />
    </div>
  );
}

export function MatchChangesStep({
  value,
  onChange,
  periodOptions,
}: {
  value: DebriefAnswersSection["match_changes"];
  onChange: (next: DebriefAnswersSection["match_changes"]) => void;
  periodOptions: string[];
}) {
  const option = value?.option;
  const requiresText = option ? MATCH_CHANGE_REQUIRES_TEXT.includes(option) : false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" role="group" aria-label="What changed during the match?">
        {MATCH_CHANGE_OPTIONS.map((opt) => (
          <Chip key={opt} label={MATCH_CHANGE_LABELS[opt]} selected={option === opt} onClick={() => onChange({ option: opt, description: value?.description, period: value?.period })} />
        ))}
      </div>
      {requiresText && (
        <LongTextField
          label="What changed?"
          value={value?.description ?? ""}
          onChange={(description) => onChange(value ? { ...value, description } : { option: option!, description })}
          placeholder="Describe the adjustment or pattern you noticed."
        />
      )}
      {option && option !== "NO_MEANINGFUL_CHANGE" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="debrief-change-period" className="text-xs text-[var(--text-muted)]">
            When · optional
          </label>
          <select
            id="debrief-change-period"
            value={value?.period ?? ""}
            onChange={(e) => onChange(value ? { ...value, period: e.target.value || undefined } : { option: option!, period: e.target.value || undefined })}
            className="min-h-11 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 text-sm text-[var(--foreground)]"
          >
            <option value="">Not specified</option>
            {periodOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function OpponentMemoryStep({ value, onChange, opponentName }: { value: DebriefAnswersSection["opponent_memory"]; onChange: (next: DebriefAnswersSection["opponent_memory"]) => void; opponentName: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--text-soft)]">Anything useful to remember about {opponentName} next time?</p>
      <LongTextField label="Opponent memory · optional" value={value.note ?? ""} onChange={(note) => onChange({ note: note || undefined })} />
    </div>
  );
}

export function AnythingElseStep({ value, onChange }: { value: DebriefAnswersSection["anything_else"]; onChange: (next: DebriefAnswersSection["anything_else"]) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--text-soft)]">Anything else worth keeping from this match?</p>
      <LongTextField label="Anything else · optional" value={value.note ?? ""} onChange={(note) => onChange({ note: note || undefined })} />
    </div>
  );
}

type PlayerOption = { id: string; name: string };

export function PlayerObservationsStep({
  value,
  onChange,
  playerOptions,
}: {
  value: DebriefAnswersSection["player_observations"];
  onChange: (next: DebriefAnswersSection["player_observations"]) => void;
  playerOptions: PlayerOption[];
}) {
  const [draftPlayerId, setDraftPlayerId] = useState(playerOptions[0]?.id ?? "");
  const [draftDirection, setDraftDirection] = useState<ObservationPolarity>("POSITIVE");
  const [draftCode, setDraftCode] = useState<FootballObservationCode>(ALL_OBSERVATION_CODES[0]);
  const [draftNote, setDraftNote] = useState("");

  const canAddMore = value.length < MAX_PLAYER_OBSERVATIONS && playerOptions.length > 0;

  function addObservation() {
    if (!draftPlayerId) return;
    onChange([...value, { playerId: draftPlayerId, observationCode: draftCode, direction: draftDirection, note: draftNote || undefined }]);
    setDraftNote("");
  }

  function removeObservation(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[var(--text-soft)]">Optional. Up to {MAX_PLAYER_OBSERVATIONS}, present players only.</p>

      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((obs, index) => {
            const playerName = playerOptions.find((p) => p.id === obs.playerId)?.name ?? "Unknown player";
            const label = getObservationLabel(obs.observationCode as FootballObservationCode, obs.direction);
            return (
              <li key={`${obs.playerId}-${index}`} className="flex items-start justify-between gap-3 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-[var(--foreground)]">
                    {playerName} — {label}
                  </span>
                  {obs.note && <span className="text-xs text-[var(--text-muted)]">{obs.note}</span>}
                </div>
                <button type="button" onClick={() => removeObservation(index)} className="min-h-11 shrink-0 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canAddMore && (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-3">
          <select value={draftPlayerId} onChange={(e) => setDraftPlayerId(e.target.value)} className="min-h-11 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 text-sm text-[var(--foreground)]">
            {playerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Chip label="Positive" selected={draftDirection === "POSITIVE"} tone="positive" onClick={() => setDraftDirection("POSITIVE")} />
            <Chip label="Negative" selected={draftDirection === "NEGATIVE"} tone="attention" onClick={() => setDraftDirection("NEGATIVE")} />
          </div>
          <select value={draftCode} onChange={(e) => setDraftCode(e.target.value as FootballObservationCode)} className="min-h-11 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 text-sm text-[var(--foreground)]">
            {ALL_OBSERVATION_CODES.map((code) => (
              <option key={code} value={code}>
                {getObservationLabel(code, draftDirection)}
              </option>
            ))}
          </select>
          <input
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Observable note · optional"
            maxLength={500}
            className="min-h-11 rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)]"
          />
          <button type="button" onClick={addObservation} className="min-h-11 self-start rounded-md bg-[var(--tl-c-accent)] px-3 text-xs font-medium text-[var(--tl-c-accent-on-fill)] hover:brightness-105">
            Add observation
          </button>
        </div>
      )}
    </div>
  );
}
