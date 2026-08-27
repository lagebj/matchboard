"use client";

import { useState, useId, useActionState } from "react";
import { saveObservationAction, updateMatchFitAction } from "@/app/(app)/matches/[matchId]/post-match/observation-actions";
import {
  ENVIRONMENT_OBSERVATION_LABELS,
  CONCERN_CATEGORY_LABELS,
  FOLLOW_UP_LABELS,
  OBSERVATION_AREA_LABELS,
  SERIOUS_CONCERN_CALLOUT,
  FACTUAL_SUMMARY_HELPER,
} from "@/lib/opponents/observation-labels";
import { PLAYING_STYLE_TAG_LABELS, PLAYING_STYLE_TAG_GROUPS, type PlayingStyleTag } from "@/lib/opponents/playing-style-tags";
import { MATCH_FIT_LABELS } from "@/lib/opponents/match-fit-labels";
import { MatchEnvironmentObservation, OpponentConcernCategory, OpponentObservationFollowUp, MatchFit } from "@/generated/prisma/client";

type Props = {
  matchId: string;
  existingObservation?: {
    id: string;
    overallEnvironment: string;
    opponentPlayersContext: string;
    opponentStaffContext: string;
    spectatorSidelineContext: string;
    concernCategories: string[];
    playingStyleTags: string[];
    factualSummary: string | null;
    followUp: string;
  } | null;
  isLocked: boolean;
  matchFit: string;
};

const ENVIRONMENT_OPTIONS: { value: MatchEnvironmentObservation; label: string }[] = [
  { value: "NOT_ASSESSED", label: ENVIRONMENT_OBSERVATION_LABELS.NOT_ASSESSED },
  { value: "POSITIVE", label: ENVIRONMENT_OBSERVATION_LABELS.POSITIVE },
  { value: "ACCEPTABLE", label: ENVIRONMENT_OBSERVATION_LABELS.ACCEPTABLE },
  { value: "CONCERN", label: ENVIRONMENT_OBSERVATION_LABELS.CONCERN },
  { value: "SERIOUS_CONCERN", label: ENVIRONMENT_OBSERVATION_LABELS.SERIOUS_CONCERN },
];

const CONCERN_CATEGORY_OPTIONS: { value: OpponentConcernCategory; label: string }[] = (
  Object.entries(CONCERN_CATEGORY_LABELS) as [OpponentConcernCategory, string][]
).map(([value, label]) => ({ value, label }));

const FOLLOW_UP_OPTIONS: { value: OpponentObservationFollowUp; label: string }[] = (
  Object.entries(FOLLOW_UP_LABELS) as [OpponentObservationFollowUp, string][]
).map(([value, label]) => ({ value, label }));

const MATCH_FIT_OPTIONS: { value: MatchFit; label: string }[] = (
  Object.entries(MATCH_FIT_LABELS) as [MatchFit, string][]
).map(([value, label]) => ({ value, label }));

export function ObservationSection({ matchId, existingObservation, isLocked, matchFit }: Props) {
  const formId = useId();
  const [matchFitValue, setMatchFitValue] = useState<string>(matchFit);
  const [overallEnvironment, setOverallEnvironment] = useState<string>(
    existingObservation?.overallEnvironment ?? "NOT_ASSESSED",
  );
  const [opponentPlayersContext, setOpponentPlayersContext] = useState<string>(
    existingObservation?.opponentPlayersContext ?? "NOT_ASSESSED",
  );
  const [opponentStaffContext, setOpponentStaffContext] = useState<string>(
    existingObservation?.opponentStaffContext ?? "NOT_ASSESSED",
  );
  const [spectatorSidelineContext, setSpectatorSidelineContext] = useState<string>(
    existingObservation?.spectatorSidelineContext ?? "NOT_ASSESSED",
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    existingObservation?.concernCategories ?? [],
  );
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(
    existingObservation?.playingStyleTags ?? [],
  );
  const [factualSummary, setFactualSummary] = useState(existingObservation?.factualSummary ?? "");
  const [followUp, setFollowUp] = useState<string>(existingObservation?.followUp ?? "NONE");

  const [observationState, formAction] = useActionState(saveObservationAction, { success: false, error: "" });
  const [matchFitState, matchFitFormAction] = useActionState(updateMatchFitAction, { success: false, error: "" });

  const ENVIRONMENT_SEVERITY: Record<string, number> = {
    NOT_ASSESSED: 0,
    POSITIVE: 1,
    ACCEPTABLE: 2,
    CONCERN: 3,
    SERIOUS_CONCERN: 4,
  };

  const anyAreaIsConcernOrSerious = [opponentPlayersContext, opponentStaffContext, spectatorSidelineContext].some(
    (v) => v === "CONCERN" || v === "SERIOUS_CONCERN",
  );
  const overallIsConcernOrHigher = ENVIRONMENT_SEVERITY[overallEnvironment] >= 3;
  const overallIsSerious = overallEnvironment === "SERIOUS_CONCERN";
  const showConcernCategories = overallIsConcernOrHigher || anyAreaIsConcernOrSerious;
  const summaryRequired = overallIsSerious;
  const summaryChars = factualSummary.length;

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  function toggleStyleTag(value: string) {
    setSelectedStyleTags((prev) => {
      if (prev.includes(value)) return prev.filter((t) => t !== value);
      if (prev.length >= 5) return prev;
      return [...prev, value];
    });
  }

  if (isLocked) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-zinc-50">Opponent and match environment</h3>
        <p className="text-sm text-zinc-400">
          This report is locked. Observations cannot be edited.
        </p>
        <div className="space-y-2 text-sm text-zinc-300">
          <p><span className="text-zinc-400">Sporting match fit:</span> {MATCH_FIT_LABELS[matchFitValue as MatchFit] ?? "Not assessed"}</p>
          <p><span className="text-zinc-400">Overall environment:</span> {existingObservation ? (ENVIRONMENT_OBSERVATION_LABELS[existingObservation.overallEnvironment as MatchEnvironmentObservation] ?? existingObservation.overallEnvironment) : "Not assessed"}</p>
          {existingObservation?.factualSummary && <p><span className="text-zinc-400">Summary:</span> {existingObservation.factualSummary}</p>}
          {existingObservation && existingObservation.followUp !== "NONE" && <p><span className="text-zinc-400">Follow-up:</span> {FOLLOW_UP_LABELS[existingObservation.followUp as OpponentObservationFollowUp] ?? existingObservation.followUp}</p>}
          {existingObservation && existingObservation.playingStyleTags.length > 0 && (
            <div>
              <span className="text-zinc-400">Playing style tags: </span>
              {existingObservation.playingStyleTags.map((tag) => PLAYING_STYLE_TAG_LABELS[tag as PlayingStyleTag] ?? tag).join(", ")}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-50">Opponent and match environment</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Record the Fair Play experience around this match using observable conditions only.
        </p>
      </div>

      {observationState.error && (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
          {observationState.error}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="matchId" value={matchId} />

        {/* A. Sporting match fit */}
        <form action={matchFitFormAction} className="space-y-2">
          <input type="hidden" name="matchId" value={matchId} />
          <h4 className="text-sm font-semibold text-zinc-50">Sporting match fit</h4>
          <p className="text-xs text-zinc-400">
            Assess the football challenge for the squad that played in this match. This describes this encounter, not a fixed level or rating of the opponent.
          </p>
          <div className="flex items-center gap-3">
            <select
              name="matchFit"
              value={matchFitValue}
              onChange={(e) => setMatchFitValue(e.target.value)}
              disabled={isLocked}
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none flex-1 disabled:opacity-60"
            >
              {MATCH_FIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!isLocked && (
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-xs font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))]"
              >
                Save
              </button>
            )}
          </div>
          {matchFitState.error && (
            <p className="text-xs text-red-400">{matchFitState.error}</p>
          )}
          {matchFitState.success && matchFit !== matchFitValue && (
            <p className="text-xs text-emerald-400">Match fit updated.</p>
          )}
        </form>

        {/* B. Match environment */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-50">Match environment</label>
          <p className="text-xs text-zinc-400">
            Record the Fair Play experience around this match using observable conditions only.
          </p>
          <select
            name="overallEnvironment"
            value={overallEnvironment}
            onChange={(e) => setOverallEnvironment(e.target.value)}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none w-full"
          >
            {ENVIRONMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* C. Areas observed */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-zinc-50">Areas observed</label>
          <div className="space-y-3">
            {(
              [
                { key: "opponentPlayersContext" as const, label: OBSERVATION_AREA_LABELS.opponentPlayersContext, value: opponentPlayersContext, setter: setOpponentPlayersContext },
                { key: "opponentStaffContext" as const, label: OBSERVATION_AREA_LABELS.opponentStaffContext, value: opponentStaffContext, setter: setOpponentStaffContext },
                { key: "spectatorSidelineContext" as const, label: OBSERVATION_AREA_LABELS.spectatorSidelineContext, value: spectatorSidelineContext, setter: setSpectatorSidelineContext },
              ] as const
            ).map(({ key, label, value, setter }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-zinc-400">{label}</label>
                <select
                  name={key}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none w-full"
                >
                  {ENVIRONMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* D. Concern categories */}
        {showConcernCategories && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-50">Observed concern categories</label>
            <p className="text-xs text-zinc-400">
              Select all that apply. Describe what was observed, not who caused it.
            </p>
            <div className="space-y-2">
              {CONCERN_CATEGORY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    name="concernCategories"
                    value={opt.value}
                    checked={selectedCategories.includes(opt.value)}
                    onChange={() => toggleCategory(opt.value)}
                    className="mt-0.5 rounded border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--accent-strong)] focus:ring-[var(--accent-strong)]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* E. Playing style tags */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-zinc-50">Opponent playing style</label>
            <p className="text-xs text-zinc-400">
              Describe the opponent's observed playing style in this encounter. This describes this match, not a fixed trait. Select up to 5.
            </p>
          </div>
          {PLAYING_STYLE_TAG_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-xs font-medium text-zinc-400">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => {
                  const isSelected = selectedStyleTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleStyleTag(tag)}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-[var(--accent-strong)] text-zinc-900"
                          : "bg-[var(--surface-base)] border border-[var(--border-soft)] text-zinc-300 hover:border-[var(--accent-strong)]"
                      }`}
                    >
                      {PLAYING_STYLE_TAG_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {selectedStyleTags.map((tag) => (
            <input key={tag} type="hidden" name="playingStyleTags" value={tag} />
          ))}
        </div>

        {/* F. Factual summary */}
        <div className="space-y-2">
          <label htmlFor={`summary-${formId}`} className="text-sm font-semibold text-zinc-50">
            Brief factual summary
            {summaryRequired && <span className="text-red-400 ml-1">*</span>}
          </label>
          <p className="text-xs text-zinc-400">
            {FACTUAL_SUMMARY_HELPER}
          </p>
          <textarea
            id={`summary-${formId}`}
            name="factualSummary"
            value={factualSummary}
            onChange={(e) => setFactualSummary(e.target.value)}
            maxLength={500}
            rows={3}
            required={summaryRequired}
            placeholder={summaryRequired ? "Required for serious concern observations..." : "Optional..."}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none w-full resize-y"
          />
          <p className="text-xs text-zinc-500">{summaryChars}/500 characters</p>
        </div>

        {/* G. Follow-up */}
        <div className="space-y-2">
          <label htmlFor={`followup-${formId}`} className="text-sm font-semibold text-zinc-50">Follow-up</label>
          <select
            id={`followup-${formId}`}
            name="followUp"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none w-full"
          >
            {FOLLOW_UP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* H. Serious concern callout */}
        {overallIsSerious && (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.5)] bg-[rgba(185,128,119,0.12)] px-4 py-3">
            <p className="text-sm text-zinc-200 font-medium">
              {SERIOUS_CONCERN_CALLOUT}
            </p>
          </div>
        )}

        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))]"
        >
          Save post-match observation
        </button>
      </form>
    </section>
  );
}