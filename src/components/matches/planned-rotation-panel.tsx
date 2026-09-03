"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { PlannedPartnershipEvidenceList } from "@/components/matches/planned-partnership-evidence";
import {
  createPlannedRotationAction,
  updatePlannedRotationAction,
  deletePlannedRotationAction,
  validatePlannedChangesAction,
  checkPlannedRotationCoverageAction,
} from "@/app/(app)/matches/planned-rotation-actions";
import type { PlannedRotationWithChanges, PlannedRotationChangeData, PlannedRotationValidationIssue, PlannedRotationCoverageIssue } from "@/lib/planned-rotation/planned-rotation";
import type { SeasonCombinationSummary } from "@/lib/evidence/combination-aggregation";
import type { PlannedScenarioEvaluation } from "@/lib/planned-rotation/scenario-evaluation";

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

const POSITION_OPTIONS = ["GK", "CB", "RB", "LB", "CDM", "CM", "CAM", "RW", "LW", "FW", "CF"];

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
  approximateMatchSeconds: string;
  notes: string;
};

const EMPTY_CHANGE: ChangeFormData = {
  outPlayerId: "",
  inPlayerId: "",
  outPosition: "",
  inPosition: "",
  positionOnly: false,
  approximateMatchSeconds: "",
  notes: "",
};

function ChangeForm({
  squadPlayers,
  initialData,
  isEditing,
  onSubmit,
  onCancel,
  isPending,
}: {
  squadPlayers: Array<{ id: string; firstName: string; lastName: string | null; primaryPosition: string }>;
  initialData: ChangeFormData;
  isEditing: boolean;
  onSubmit: (data: ChangeFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ChangeFormData>(initialData);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={form.positionOnly}
            onChange={(e) => setForm((f) => ({ ...f, positionOnly: e.target.checked }))}
            className="rounded border-[var(--border-subtle)]"
          />
          Position swap
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">
            {form.positionOnly ? "Player out" : "Player out"}
          </label>
          <select
            value={form.outPlayerId}
            onChange={(e) => {
              const playerId = e.target.value;
              const player = squadPlayers.find((p) => p.id === playerId);
              setForm((f) => ({
                ...f,
                outPlayerId: playerId,
                outPosition: playerId ? (f.outPosition || player?.primaryPosition || "") : "",
              }));
            }}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          >
            <option value="">Select player</option>
            {squadPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {playerDisplayName(p.firstName, p.lastName)} ({p.primaryPosition})
              </option>
            ))}
          </select>
        </div>

        {!form.positionOnly && (
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-0.5">Position out</label>
            <select
              value={form.outPosition}
              onChange={(e) => setForm((f) => ({ ...f, outPosition: e.target.value }))}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-sm"
            >
              <option value="">Auto</option>
              {POSITION_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">
            {form.positionOnly ? "Player in" : "Player in"}
          </label>
          <select
            value={form.inPlayerId}
            onChange={(e) => {
              const playerId = e.target.value;
              const player = squadPlayers.find((p) => p.id === playerId);
              setForm((f) => ({
                ...f,
                inPlayerId: playerId,
                inPosition: playerId ? (f.inPosition || player?.primaryPosition || "") : "",
              }));
            }}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          >
            <option value="">Select player</option>
            {squadPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {playerDisplayName(p.firstName, p.lastName)} ({p.primaryPosition})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">
            {form.positionOnly ? "Position in" : "Position in"}
          </label>
          <select
            value={form.inPosition}
            onChange={(e) => setForm((f) => ({ ...f, inPosition: e.target.value }))}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          >
            <option value="">Auto</option>
            {POSITION_OPTIONS.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">Approx. time</label>
          <input
            type="text"
            placeholder="e.g. 1500 (25')"
            value={form.approximateMatchSeconds}
            onChange={(e) => setForm((f) => ({ ...f, approximateMatchSeconds: e.target.value.replace(/[^0-9]/g, "") }))}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-0.5">Notes</label>
          <input
            type="text"
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <Button onClick={() => onSubmit(form)} disabled={isPending} size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" />
          {isEditing ? "Save change" : "Add change"}
        </Button>
        <Button onClick={onCancel} variant="ghost" size="sm" disabled={isPending}>
          Cancel
        </Button>
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
    approximateMatchSeconds: change.approximateMatchSeconds?.toString() ?? "",
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
    approximateMatchSeconds: form.approximateMatchSeconds ? parseInt(form.approximateMatchSeconds, 10) : null,
    notes: form.notes || null,
  };
}

export function PlannedRotationPanel({ matchId, teamId, rotation, squadPlayers, readOnly = false }: PlannedRotationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
          <div className="mt-4">
            <Button onClick={handleCreate} disabled={isPending} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create rotation plan
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-[var(--text-error)]">{error}</p>}
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
        <div className="mt-4 flex flex-col gap-2">
          {rotation.changes.map((change, index) => {
            const outPlayer = change.outPlayerId ? playerById.get(change.outPlayerId) : null;
            const inPlayer = change.inPlayerId ? playerById.get(change.inPlayerId) : null;

            return (
              <div
                key={change.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
              >
                {isDraft && !readOnly && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => handleMoveChange(change.id, "up")}
                      disabled={isPending || index === 0}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveChange(change.id, "down")}
                      disabled={isPending || index === rotation.changes.length - 1}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
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
                  {change.approximateMatchSeconds !== null && (
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      ~{formatSeconds(change.approximateMatchSeconds)}
                    </div>
                  )}
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
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      aria-label="Edit change"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveChange(change.id)}
                      disabled={isPending}
                      className="text-[var(--text-muted)] hover:text-[var(--text-error)] disabled:opacity-30"
                      aria-label="Remove change"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isDraft && !readOnly && editingChangeId && rotation && (
        <div className="mt-3">
          <ChangeForm
            squadPlayers={squadPlayers}
            initialData={changeToFormData(rotation.changes.find((c) => c.id === editingChangeId)!)}
            isEditing={true}
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
              onSubmit={handleSaveChange}
              onCancel={() => setShowAddForm(false)}
              isPending={isPending}
            />
          ) : (
            <Button onClick={() => setShowAddForm(true)} variant="secondary" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add change
            </Button>
          )}
        </div>
      )}

      {rotation.notes && (
        <div className="mt-3 text-sm text-[var(--text-muted)] italic">{rotation.notes}</div>
      )}

      {isDraft && !readOnly && rotation.changes.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={handleDelete} disabled={isPending} variant="danger" size="sm">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete plan
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[var(--text-error)]">{error}</p>}

      {validationIssues.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {validationIssues.map((issue, index) => (
            <p
              key={index}
              className={`text-sm ${issue.type === "error" ? "text-[var(--text-error)]" : "text-[var(--text-muted)]"}`}
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

      {coverageIssues.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
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

      {scenario && (scenario.opponentContext.length > 0 || scenario.transitions.some((t) => t.signals.length > 0)) && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--text-soft)]">
            What happens with this plan — a hypothetical projection, not a prediction
          </p>

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
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2.5"
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
      )}
    </Surface>
  );
}