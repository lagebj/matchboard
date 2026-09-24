"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, X, ShieldAlert, Sparkles } from "lucide-react";
import { TouchlineButton } from "@/components/touchline";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { PlannedPartnershipEvidenceList } from "@/components/matches/planned-partnership-evidence";
import { MetricStory } from "@/components/viz";
import { TouchlineTimeline, TimelineItem } from "@/components/touchline/timeline/touchline-timeline";
import { computeRotationTimelineStates } from "@/lib/planned-rotation/get-rotation-timeline-states";
import {
  createPlannedRotationAction,
  updatePlannedRotationAction,
  deletePlannedRotationAction,
  validatePlannedChangesAction,
  checkPlannedRotationCoverageAction,
  generateRotationPlanAction,
} from "@/app/(app)/matches/planned-rotation-actions";
import type { PlannedRotationWithChanges, PlannedRotationChangeData, PlannedRotationValidationIssue, PlannedRotationCoverageIssue } from "@/lib/planned-rotation/planned-rotation";
import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import type { PlannedScenarioEvaluation } from "@/lib/planned-rotation/scenario-evaluation";

/**
 * A player's position per the already-computed plan projection (`scenario.intervals`, from
 * `checkPlannedRotationCoverageAction` -> `evaluatePlannedScenario`/`projectPlannedLineup`) at a
 * given planned time -- the position they'd actually be in per the starting formation slot and
 * every earlier-sequenced change, not their declared `Player.primaryPosition`. Type-only import
 * of the evaluator keeps this client component free of its `@/lib/db`-importing runtime module;
 * this function only ever reads the plain, already-serialized `scenario` data passed down from
 * the parent's own server-action call, never recomputes the projection itself.
 *
 * Intervals are sorted ascending by `startSeconds` (`buildPlannedScenarioIntervals`) -- the last
 * one starting at or before `atSeconds` is "now". `atSeconds: null` (no time entered yet) reads
 * the latest known interval, i.e. the plan's current state as of its last change so far.
 */
export function lookupProjectedPosition(
  scenario: PlannedScenarioEvaluation | null,
  playerId: string,
  atSeconds: number | null,
): string | null {
  if (!scenario || scenario.intervals.length === 0) return null;
  const target = atSeconds ?? Infinity;
  let current = scenario.intervals[0]!;
  for (const interval of scenario.intervals) {
    if (interval.startSeconds > target) break;
    current = interval;
  }
  return current.players.find((p) => p.playerId === playerId)?.position ?? null;
}

/**
 * Which squad players are actually on the pitch per the plan projection (same `scenario.intervals`
 * source as `lookupProjectedPosition` above, same "last interval starting at or before atSeconds
 * is now" lookup and `atSeconds: null` -> latest-known-state default) at a given planned time —
 * used to scope "Player out" to players genuinely on the field then, and "Player in" (the
 * complement against the full squad) to players genuinely on the bench then, instead of listing
 * the entire match squad regardless of who's actually playing at that moment. `interval.players`
 * is already on-pitch-only (`buildPlannedScenarioIntervals` filters to `state.onPitch`), so every
 * entry here is already exactly the on-field set — no further filtering needed.
 *
 * `null` (no lineup projected yet, e.g. no starting line-up set) returns an empty set — callers
 * should fall back to the full squad in that case, matching the pre-existing "list everyone"
 * behavior for a match that hasn't been lined up yet rather than showing an empty dropdown.
 */
export function lookupOnFieldPlayerIds(
  scenario: PlannedScenarioEvaluation | null,
  atSeconds: number | null,
): Set<string> {
  if (!scenario || scenario.intervals.length === 0) return new Set();
  const target = atSeconds ?? Infinity;
  let current = scenario.intervals[0]!;
  for (const interval of scenario.intervals) {
    if (interval.startSeconds > target) break;
    current = interval;
  }
  return new Set(current.players.map((p) => p.playerId));
}

/**
 * "Player out"/"Player in" option label — the player's name plus, in parentheses, their current
 * on-field position per the plan projection (`lookupProjectedPosition`) at this change's own
 * planned time, never their declared `Player.primaryPosition`. A bench player (not on the pitch
 * at all at this time — `lookupProjectedPosition` returns `null`) shows no parenthetical at all,
 * rather than falling back to a declared position that may not reflect where they'd actually
 * enter the pitch.
 */
export function formatPlayerOptionLabel(
  player: { id: string; firstName: string; lastName: string | null },
  scenario: PlannedScenarioEvaluation | null,
  atSeconds: number | null,
): string {
  const name = playerDisplayName(player.firstName, player.lastName);
  const projected = lookupProjectedPosition(scenario, player.id, atSeconds);
  return projected ? `${name} (${projected})` : name;
}

type PlannedRotationPanelProps = {
  matchId: string;
  teamId: string;
  rotation: PlannedRotationWithChanges | null;
  squadPlayers: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string;
  }>;
  readOnly?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  APPLIED: "Applied",
  SUPERSEDED: "Superseded",
};

const CHANGE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPLIED: "Applied",
  SKIPPED: "Skipped",
  MODIFIED: "Modified",
};


const COVERAGE_ISSUE_LABELS: Record<PlannedRotationCoverageIssue["type"], string> = {
  no_goalkeeper: "No goalkeeper in the starting line-up or planned changes",
  position_gap: "Position gap in the starting line-up",
  below_minimum: "Starting line-up has fewer players than the game format requires",
  untimed_change: "One or more changes have no approximate time and cannot be checked",
};

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}'${secs.toString().padStart(2, "0")}"`;
}

function playerDisplayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "—";
}

type ChangeFormData = {
  outPlayerId: string;
  inPlayerId: string;
  outPosition: string;
  inPosition: string;
  positionOnly: boolean;
  // Whole minutes, as the coach enters/sees it — never the persisted `PlannedRotationChangeData`
  // unit (seconds). Converted at the two boundaries only: `changeToFormData` (seconds -> minutes,
  // reading a saved change into the form) and `formDataToChangeData` (minutes -> seconds, saving
  // the form). Before this, the field held raw seconds and the coach had to hand-compute e.g.
  // "1500" for the 25th minute -- minutes is what a coach actually thinks in.
  approximateMatchMinutes: string;
  notes: string;
};

const EMPTY_CHANGE: ChangeFormData = {
  outPlayerId: "",
  inPlayerId: "",
  outPosition: "",
  inPosition: "",
  positionOnly: false,
  approximateMatchMinutes: "",
  notes: "",
};

function ChangeForm({
  squadPlayers,
  initialData,
  isEditing,
  scenario,
  onSubmit,
  onCancel,
  isPending,
}: {
  squadPlayers: Array<{ id: string; firstName: string; lastName: string | null; primaryPosition: string }>;
  initialData: ChangeFormData;
  isEditing: boolean;
  /** The plan's already-computed projection (parent's `scenario` state), used to auto-fill a
   * position-swap's "current position" fields correctly instead of guessing from
   * `Player.primaryPosition` -- see `lookupProjectedPosition`'s doc comment. `null` when no
   * lineup exists yet to project from (the field then falls back to the declared position, same
   * as today, rather than staying empty). */
  scenario: PlannedScenarioEvaluation | null;
  onSubmit: (data: ChangeFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ChangeFormData>(initialData);

  // Issue #674: scope "Player out"/"Player in" to who is actually on the field/bench at this
  // change's own planned minute, instead of listing the entire match squad regardless of time --
  // reuses the same plan projection `lookupProjectedPosition` already reads. No lineup projected
  // yet (`onFieldIds` empty) falls back to the full squad for both, matching the pre-existing
  // "list everyone" behavior for a match that hasn't been lined up.
  //
  // A position swap (`positionOnly`) exchanges two players who are BOTH already on the pitch --
  // neither leaves or enters -- so "Player in" must also be scoped to on-field players there, not
  // the bench (the domain's own precondition already rejects a swap naming a bench player; this
  // just stops the form from offering one in the first place). A plain rotation is the only case
  // where "Player in" means the bench.
  const atSeconds = form.approximateMatchMinutes ? parseInt(form.approximateMatchMinutes, 10) * 60 : null;
  const onFieldIds = lookupOnFieldPlayerIds(scenario, atSeconds);
  const outPlayerOptions = onFieldIds.size > 0 ? squadPlayers.filter((p) => onFieldIds.has(p.id)) : squadPlayers;
  const inPlayerOptions =
    onFieldIds.size === 0
      ? squadPlayers
      : form.positionOnly
        ? squadPlayers.filter((p) => onFieldIds.has(p.id))
        : squadPlayers.filter((p) => !onFieldIds.has(p.id));

  // Issue #674: position is never coach-selected, for either a plain rotation or a position
  // swap -- the system derives it from the plan projection (or, for a plain rotation's incoming
  // player, from the vacated slot) the same way `projectPlannedLineup`'s own domain default
  // already does. `outPosition`/`inPosition` stay on `ChangeFormData`/the persisted record (never
  // removed -- see the issue's own follow-up clarification) purely so downstream readers
  // (display, AI advisor context, insight facts) keep a real value; the coach just never sees or
  // picks it.
  //
  // Follow-up (2026-09-24): each "Player out"/"Player in" option's own label still shows a
  // position, in parentheses -- but it's the player's *current on-field position* from this same
  // plan projection (`formatPlayerOptionLabel`), not their declared `primaryPosition`, and it's
  // shown only for a player actually on the pitch at this time. A bench player's option carries
  // no parenthetical at all -- there is no "current position" to show for someone not playing.

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] p-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={form.positionOnly}
            onChange={(e) => setForm((f) => ({ ...f, positionOnly: e.target.checked }))}
            className="rounded border-[var(--border-soft)]"
          />
          Position swap
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">Player out</label>
          <select
            value={form.outPlayerId}
            onChange={(e) => {
              const playerId = e.target.value;
              const player = squadPlayers.find((p) => p.id === playerId);
              setForm((f) => {
                if (!playerId) return { ...f, outPlayerId: "", outPosition: "" };
                // A position-only swap exchanges each player's *current on-field* position, not
                // their declared `primaryPosition` -- pre-filling from `primaryPosition` silently
                // produced a wrong value whenever they differed (production incident: a player
                // who started at CB, declared ST, had a swap recorded as if he were still at
                // ST). The same fix applies to a plain rotation's outgoing player too -- their
                // projected on-field position, not their declared one.
                const projected = lookupProjectedPosition(scenario, playerId, atSeconds);
                const outPosition = projected ?? player?.primaryPosition ?? "";
                // Plain rotation: the incoming player (if already picked) takes over the vacated
                // slot by default, mirroring `projectPlannedLineup`'s own `inPosition ?? vacatedPosition`.
                const inPosition = f.positionOnly ? f.inPosition : f.inPlayerId ? outPosition : f.inPosition;
                return { ...f, outPlayerId: playerId, outPosition, inPosition };
              });
            }}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          >
            <option value="">Select player</option>
            {outPlayerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPlayerOptionLabel(p, scenario, atSeconds)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">Player in</label>
          <select
            value={form.inPlayerId}
            onChange={(e) => {
              const playerId = e.target.value;
              const player = squadPlayers.find((p) => p.id === playerId);
              setForm((f) => {
                if (!playerId) return { ...f, inPlayerId: "", inPosition: "" };
                if (f.positionOnly) {
                  // See the "Player out" handler above -- same reasoning, same fix.
                  const projected = lookupProjectedPosition(scenario, playerId, atSeconds);
                  return { ...f, inPlayerId: playerId, inPosition: projected ?? player?.primaryPosition ?? "" };
                }
                // Plain rotation: incoming player takes the outgoing player's (vacated) position.
                return { ...f, inPlayerId: playerId, inPosition: f.outPosition || player?.primaryPosition || "" };
              });
            }}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          >
            <option value="">Select player</option>
            {inPlayerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPlayerOptionLabel(p, scenario, atSeconds)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {form.positionOnly && (
        <p className="text-[10px] text-[var(--text-muted)] -mt-1">
          Position swap: the two players exchange positions with each other. No position entry
          needed -- the system already knows where each one is playing.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">Approx. minute</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 25"
            value={form.approximateMatchMinutes}
            onChange={(e) => setForm((f) => ({ ...f, approximateMatchMinutes: e.target.value.replace(/[^0-9]/g, "") }))}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">Notes</label>
          <input
            type="text"
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <TouchlineButton onClick={() => onSubmit(form)} disabled={isPending} size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" />
          {isEditing ? "Save change" : "Add change"}
        </TouchlineButton>
        <TouchlineButton onClick={onCancel} variant="ghost" size="sm" disabled={isPending}>
          Cancel
        </TouchlineButton>
      </div>
    </div>
  );
}

function changeToFormData(change: PlannedRotationWithChanges["changes"][number]): ChangeFormData {
  return {
    outPlayerId: change.outPlayerId ?? "",
    inPlayerId: change.inPlayerId ?? "",
    outPosition: change.outPosition ?? "",
    inPosition: change.inPosition ?? "",
    positionOnly: change.positionOnly,
    approximateMatchMinutes:
      change.approximateMatchSeconds != null ? Math.round(change.approximateMatchSeconds / 60).toString() : "",
    notes: change.notes ?? "",
  };
}

function formDataToChangeData(form: ChangeFormData): PlannedRotationChangeData {
  return {
    outPlayerId: form.outPlayerId || null,
    inPlayerId: form.inPlayerId || null,
    outPosition: form.outPosition || null,
    inPosition: form.inPosition || null,
    positionOnly: form.positionOnly,
    approximateMatchSeconds: form.approximateMatchMinutes ? parseInt(form.approximateMatchMinutes, 10) * 60 : null,
    notes: form.notes || null,
  };
}

export function PlannedRotationPanel({ matchId, teamId, rotation, squadPlayers, readOnly = false }: PlannedRotationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generationDiagnostics, setGenerationDiagnostics] = useState<string[]>([]);
  const [validationIssues, setValidationIssues] = useState<PlannedRotationValidationIssue[]>([]);
  const [coverageIssues, setCoverageIssues] = useState<PlannedRotationCoverageIssue[]>([]);
  const [hasLineup, setHasLineup] = useState<boolean | null>(null);
  const [partnershipEvidence, setPartnershipEvidence] = useState<SeasonCombinationSummary[]>([]);
  const [scenario, setScenario] = useState<PlannedScenarioEvaluation | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChangeId, setEditingChangeId] = useState<string | null>(null);

  const playerById = new Map(squadPlayers.map((p) => [p.id, p]));

  async function runValidation(changes: PlannedRotationChangeData[]) {
    try {
      const result = await validatePlannedChangesAction(matchId, teamId, changes);
      if (result.success) {
        setValidationIssues(result.issues);
      }
    } catch {
      // validation is advisory; don't block on failure
    }
  }

  async function runCoverageCheck(changes: PlannedRotationChangeData[]) {
    try {
      const result = await checkPlannedRotationCoverageAction(matchId, teamId, changes);
      if (result.success) {
        setHasLineup(result.hasLineup);
        setCoverageIssues(result.issues);
        setPartnershipEvidence(result.partnershipEvidence);
        setScenario(result.hasLineup ? result.scenario : null);
      }
    } catch {
      // coverage checking is advisory; don't block on failure
    }
  }

  useEffect(() => {
    if (rotation) {
      const changes = rotation.changes
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((c) => ({
          outPlayerId: c.outPlayerId,
          inPlayerId: c.inPlayerId,
          outPosition: c.outPosition,
          inPosition: c.inPosition,
          positionOnly: c.positionOnly,
          approximateMatchSeconds: c.approximateMatchSeconds,
          notes: c.notes,
        }));
      runCoverageCheck(changes);
    }
    // Only re-run when the rotation identity or its change count changes — individual field edits
    // are covered by the explicit runCoverageCheck calls after each mutation below.
  }, [rotation?.id, rotation?.changes.length]);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createPlannedRotationAction({ matchId, teamId });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!rotation) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePlannedRotationAction(rotation.id);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleGenerate() {
    setError(null);
    setGenerationDiagnostics([]);
    startTransition(async () => {
      const result = await generateRotationPlanAction(matchId, teamId);
      if (!result.success) {
        setError(result.error);
      } else {
        setGenerationDiagnostics(result.diagnostics);
      }
    });
  }

  function handleSaveChange(formData: ChangeFormData) {
    if (!rotation) return;
    const newChange = formDataToChangeData(formData);
    const sortedChanges = [...rotation.changes].sort((a, b) => a.sequence - b.sequence);

    const changes = sortedChanges.map((c) => {
      if (editingChangeId && c.id === editingChangeId) {
        return newChange;
      }
      return {
        outPlayerId: c.outPlayerId,
        inPlayerId: c.inPlayerId,
        outPosition: c.outPosition,
        inPosition: c.inPosition,
        positionOnly: c.positionOnly,
        approximateMatchSeconds: c.approximateMatchSeconds,
        notes: c.notes,
      };
    });

    if (!editingChangeId) {
      changes.push(newChange);
    }

    startTransition(async () => {
      const result = await updatePlannedRotationAction(rotation.id, { changes });
      if (!result.success) {
        setError(result.error);
      } else {
        setShowAddForm(false);
        setEditingChangeId(null);
        setValidationIssues([]);
        runValidation(changes);
        runCoverageCheck(changes);
      }
    });
  }

  function handleRemoveChange(changeId: string) {
    if (!rotation) return;
    const changes = rotation.changes
      .filter((c) => c.id !== changeId)
      .sort((a, b) => a.sequence - b.sequence)
      .map((c) => ({
        outPlayerId: c.outPlayerId,
        inPlayerId: c.inPlayerId,
        outPosition: c.outPosition,
        inPosition: c.inPosition,
        positionOnly: c.positionOnly,
        approximateMatchSeconds: c.approximateMatchSeconds,
        notes: c.notes,
      }));

    startTransition(async () => {
      const result = await updatePlannedRotationAction(rotation.id, { changes });
      if (!result.success) {
        setError(result.error);
      } else {
        setValidationIssues([]);
        runValidation(changes);
        runCoverageCheck(changes);
      }
    });
  }

  function handleMoveChange(changeId: string, direction: "up" | "down") {
    if (!rotation || rotation.status !== "DRAFT") return;
    const sortedChanges = [...rotation.changes].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedChanges.findIndex((c) => c.id === changeId);
    if (currentIndex === -1) return;

    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === sortedChanges.length - 1) return;

    const newChanges = [...sortedChanges];
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    [newChanges[currentIndex], newChanges[swapIndex]] = [newChanges[swapIndex], newChanges[currentIndex]];

    const updatedChanges = newChanges.map((c) => ({
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      notes: c.notes,
    }));

    startTransition(async () => {
      const result = await updatePlannedRotationAction(rotation.id, { changes: updatedChanges });
      if (!result.success) {
        setError(result.error);
      } else {
        setValidationIssues([]);
        runValidation(updatedChanges);
        runCoverageCheck(updatedChanges);
      }
    });
  }

  const isDraft = rotation?.status === "DRAFT";

  if (!rotation) {
    return (
      <Surface padding="md">
        <SectionHeader title="Rotation plan" eyebrow="Pre-match" />
        <div className="mt-3 text-sm text-[var(--text-muted)]">
          No rotation plan yet. Create one to plan substitutions and position changes before kickoff.
        </div>
        {!readOnly && (
          <div className="mt-4 flex flex-wrap gap-2">
            <TouchlineButton onClick={handleCreate} disabled={isPending} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create rotation plan
            </TouchlineButton>
            <TouchlineButton onClick={handleGenerate} disabled={isPending} variant="secondary" size="sm">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate rotation plan
            </TouchlineButton>
          </div>
        )}
        {!readOnly && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Generating produces a starting proposal from role fit, fairness, and any recorded
            opponent/history evidence — set a match line-up first, then review and adjust every
            generated change.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      </Surface>
    );
  }

  return (
    <Surface padding="md">
      <div className="flex items-center justify-between">
        <SectionHeader title="Rotation plan" eyebrow="Pre-match" />
        <StatusPill variant={rotation.status === "DRAFT" ? "neutral" : rotation.status === "APPLIED" ? "success" : "info"}>
          {STATUS_LABELS[rotation.status] ?? rotation.status}
        </StatusPill>
      </div>

      {rotation.changes.length === 0 && !showAddForm && (
        <div className="mt-3 text-sm text-[var(--text-muted)]">
          No planned changes yet. Add substitutions or position changes to the rotation plan.
        </div>
      )}

      {rotation.changes.length > 0 && (
        <div className="mt-4">
          {/* Touchline Design Atlas (ADR-0136, Phase 5): "exact chronological decision points"
              (`08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §D`) via the shared `TouchlineTimeline`
              primitive (already used by Today), replacing the previous flat bordered-card list --
              "no disconnected substitution-card grid" per the same spec. Every existing control
              inside each item (move/edit/delete, the add-form toggle) is unchanged. */}
          <TouchlineTimeline aria-label="Planned rotation changes">
          {(() => {
            const timelineStates = computeRotationTimelineStates(rotation.changes);
            return rotation.changes.map((change, index) => {
            const outPlayer = change.outPlayerId ? playerById.get(change.outPlayerId) : null;
            const inPlayer = change.inPlayerId ? playerById.get(change.inPlayerId) : null;

            return (
              <TimelineItem
                key={change.id}
                timeLabel={change.approximateMatchSeconds !== null ? `~${formatSeconds(change.approximateMatchSeconds)}` : null}
                state={timelineStates[index]}
                isLast={index === rotation.changes.length - 1}
              >
              <div className="flex items-center gap-2">
                {isDraft && !readOnly && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => handleMoveChange(change.id, "up")}
                      disabled={isPending || index === 0}
                      className="text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveChange(change.id, "down")}
                      disabled={isPending || index === rotation.changes.length - 1}
                      className="text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--text-muted)]">{index + 1}.</span>
                    {change.positionOnly ? (
                      <span className="text-sm">
                        <span className="font-medium">{change.outPlayerFirstName ?? outPlayer?.firstName ?? "—"}</span>
                        {" "}
                        <span className="text-[var(--text-muted)]">↔</span>
                        {" "}
                        <span className="font-medium">{change.inPlayerFirstName ?? inPlayer?.firstName ?? "—"}</span>
                        <span className="text-[var(--text-muted)] ml-1">(pos. swap)</span>
                      </span>
                    ) : (
                      <span className="text-sm">
                        <span className="font-medium">{change.outPlayerFirstName ?? outPlayer?.firstName ?? "—"}</span>
                        {" out"}
                        {change.outPosition && <span className="text-[var(--text-muted)] ml-0.5">({change.outPosition})</span>}
                        {" → "}
                        <span className="font-medium">{change.inPlayerFirstName ?? inPlayer?.firstName ?? "—"}</span>
                        {" in"}
                        {change.inPosition && <span className="text-[var(--text-muted)] ml-0.5">({change.inPosition})</span>}
                      </span>
                    )}
                  </div>
                  {change.notes && (
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 italic">{change.notes}</div>
                  )}
                </div>

                <StatusPill variant="neutral" size="sm">
                  {CHANGE_STATUS_LABELS[change.status] ?? change.status}
                </StatusPill>

                {isDraft && !readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingChangeId(change.id)}
                      disabled={isPending}
                      className="text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                      aria-label="Edit change"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveChange(change.id)}
                      disabled={isPending}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-30"
                      aria-label="Remove change"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              </TimelineItem>
            );
            });
          })()}
          </TouchlineTimeline>
        </div>
      )}

      {isDraft && !readOnly && editingChangeId && rotation && (
        <div className="mt-3">
          <ChangeForm
            squadPlayers={squadPlayers}
            initialData={changeToFormData(rotation.changes.find((c) => c.id === editingChangeId)!)}
            isEditing={true}
            scenario={scenario}
            onSubmit={handleSaveChange}
            onCancel={() => setEditingChangeId(null)}
            isPending={isPending}
          />
        </div>
      )}

      {isDraft && !readOnly && !editingChangeId && (
        <div className="mt-3">
          {showAddForm ? (
            <ChangeForm
              squadPlayers={squadPlayers}
              initialData={EMPTY_CHANGE}
              isEditing={false}
              scenario={scenario}
              onSubmit={handleSaveChange}
              onCancel={() => setShowAddForm(false)}
              isPending={isPending}
            />
          ) : (
            <TouchlineButton onClick={() => setShowAddForm(true)} variant="secondary" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add change
            </TouchlineButton>
          )}
        </div>
      )}

      {rotation.notes && (
        <div className="mt-3 text-sm text-[var(--text-muted)] italic">{rotation.notes}</div>
      )}

      {isDraft && !readOnly && rotation.changes.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <TouchlineButton onClick={handleDelete} disabled={isPending} variant="danger" size="sm">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete plan
          </TouchlineButton>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      {validationIssues.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {validationIssues.map((issue, index) => (
            <p
              key={index}
              className={`text-sm ${issue.type === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}
            >
              {issue.changeIndex !== null ? `Change ${issue.changeIndex + 1}: ` : ""}
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {rotation.changes.length > 0 && hasLineup === false && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Set a starting line-up in the Tactics tab to see coverage checks (goalkeeper, minimum players on pitch) for this plan.
        </p>
      )}

      {generationDiagnostics.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-soft)]">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Generation notes
          </div>
          {generationDiagnostics.map((note, index) => (
            <p key={index} className="text-sm text-[var(--warning)]">
              {note}
            </p>
          ))}
          <p className="text-xs text-[var(--text-muted)]">
            No automatically eligible replacement was available for these positions, so the
            player was kept on. Make a manual change if you want to rotate anyway.
          </p>
        </div>
      )}

      {coverageIssues.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-soft)]">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Coverage check
          </div>
          {coverageIssues.map((issue, index) => (
            <p key={index} className="text-sm text-[var(--warning)]">
              {COVERAGE_ISSUE_LABELS[issue.type] ?? issue.description}
            </p>
          ))}
        </div>
      )}

      {partnershipEvidence.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--text-soft)]">Partnership evidence</p>
          <div className="mt-1.5">
            <PlannedPartnershipEvidenceList
              summaries={partnershipEvidence}
              playerNameById={Object.fromEntries(
                squadPlayers.map((p) => [p.id, `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`]),
              )}
            />
          </div>
        </div>
      )}

      {scenario && (scenario.opponentContext.length > 0 || scenario.transitions.some((t) => t.signals.length > 0)) && (() => {
        // Evidence-story framing (ADR-0125): planned rotation evidence →
        // MetricStory (no chart — the engine supplies no numeric comparator).
        const historicalSignals = [
          ...scenario.opponentContext,
          ...scenario.transitions.flatMap((t) => t.signals),
          ...scenario.startingLineupSignals.map((s) => s.signal),
        ].filter((s) => s.kind === "HISTORICAL_PATTERN");
        return (
        <div className="mt-3 flex flex-col gap-2">
          {historicalSignals.length > 0 ? (
            <MetricStory
              question="Does this rotation plan resemble a historical pattern worth checking?"
              label="Rotation pattern to review"
              value={`${historicalSignals.length} relevant historical observation${historicalSignals.length === 1 ? "" : "s"}`}
              interpretation={historicalSignals[0].text}
            />
          ) : (
            <p className="text-xs font-semibold text-[var(--text-soft)]">
              What happens with this plan — a hypothetical projection, not a prediction
            </p>
          )}

          {scenario.opponentContext.length > 0 && (
            <ul className="flex flex-col gap-1">
              {scenario.opponentContext.map((signal, index) => (
                <li key={index} className="text-xs text-[var(--text-muted)]">
                  {signal.text}
                </li>
              ))}
            </ul>
          )}

          {scenario.transitions
            .filter((t) => t.signals.length > 0)
            .map((transition, index) => (
              <div
                key={index}
                className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] p-2.5"
              >
                <p className="text-xs font-medium text-[var(--text-soft)]">
                  At ~{formatSeconds(transition.atSeconds)}
                  {transition.substitutionCount > 0 ? ` · ${transition.substitutionCount} change${transition.substitutionCount === 1 ? "" : "s"}` : ""}
                  {transition.positionOnlyChanges.length > 0 ? " · position swap" : ""}
                </p>
                <ul className="mt-1 flex flex-col gap-1">
                  {transition.signals.map((signal, signalIndex) => (
                    <li key={signalIndex} className="text-xs text-[var(--text-muted)]">
                      {signal.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
        );
      })()}
    </Surface>
  );
}