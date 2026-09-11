"use client";

import { useState } from "react";
import { TouchlineButton } from "@/components/touchline";
import { updateRotationPathAction, deleteRotationPathAction, toggleRotationPathActiveAction } from "@/app/(app)/rules/actions";
import { useActionState } from "react";

type RotationPathDetail = {
  id: string;
  fromTeamId: string;
  fromTeamName: string;
  toTeamId: string;
  toTeamName: string;
  role: string;
  purpose: string | null;
  priority: number | null;
  minimumCount: number | null;
  targetCount: number | null;
  maximumCount: number | null;
  cooldownRounds: number | null;
  active: boolean;
};

function formatRoleDisplay(role: string): string {
  switch (role) {
    case "BACKFILL": return "Squad repair";
    default: return role.charAt(0) + role.slice(1).toLowerCase();
  }
}

// Categorical rotation-path-role legend (Support/Development/Squad repair) — a fixed data-viz
// hue key, not outcome or severity coloring, matching the same treatment as tactics-board.tsx's
// ROLE_COLORS and season-client.tsx's ROLE_CELL_STYLES.
function roleBadgeClasses(role: string): string {
  switch (role) {
    case "SUPPORT": return "border-[color-mix(in_srgb,var(--tl-c-evidence)_35%,transparent)] bg-[var(--tl-c-evidence-subtle)] text-[var(--tl-c-evidence)]";
    case "DEVELOPMENT": return "border-[rgba(140,167,146,0.24)] bg-[rgba(140,167,146,0.08)] text-[var(--accent-strong)]";
    case "BACKFILL": return "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] text-[var(--warning)]";
    default: return "border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] text-[var(--text-soft)]";
  }
}

function ToggleActiveForm({ path, teamId }: { path: RotationPathDetail; teamId: string }) {
  const [state, formAction, isPending] = useActionState(toggleRotationPathActiveAction, { error: "" });

  return (
    <form action={formAction}>
      <input name="pathId" type="hidden" defaultValue={path.id} />
      <input name="redirectTeamId" type="hidden" defaultValue={teamId} />
      {state.error && (
        <p className="mb-2 text-xs text-[var(--danger)]">{state.error}</p>
      )}
      <button
        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
          path.active
            ? "border-[var(--accent)]/40 bg-[var(--accent-subtle)] text-[var(--accent-strong)] hover:brightness-105"
            : "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] text-[var(--danger)] hover:brightness-110"
        }`}
        disabled={isPending}
        type="submit"
      >
        {path.active ? "Active" : "Inactive"}
      </button>
    </form>
  );
}

function DeleteForm({ path, teamId }: { path: RotationPathDetail; teamId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteRotationPathAction, { error: "" });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--danger)]">Delete this path?</span>
        <form action={formAction}>
          <input name="pathId" type="hidden" defaultValue={path.id} />
          <input name="redirectTeamId" type="hidden" defaultValue={teamId} />
          <button
            className="rounded-full border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-3 py-1 text-xs font-medium text-[var(--danger)] hover:brightness-110"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Deleting..." : "Confirm delete"}
          </button>
          <button
            className="ml-1 rounded-full border app-hairline px-3 py-1 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)]"
            onClick={() => setConfirming(false)}
            type="button"
          >
            Cancel
          </button>
          {state.error && <p className="mt-1 text-xs text-[var(--danger)]">{state.error}</p>}
        </form>
      </div>
    );
  }

  return (
    <button
      className="rounded-full border app-hairline px-3 py-1 text-xs app-copy-soft hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)]"
      onClick={() => setConfirming(true)}
      type="button"
    >
      Delete
    </button>
  );
}

export function RotationPathCard({
  path,
  teamId,
  direction,
}: {
  path: RotationPathDetail;
  teamId: string;
  direction: "outgoing" | "incoming";
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <RotationPathEditForm
        path={path}
        teamId={teamId}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--foreground)]">{direction === "outgoing" ? path.toTeamName : path.fromTeamName}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${roleBadgeClasses(path.role)}`}>
            {formatRoleDisplay(path.role)}
          </span>
          <ToggleActiveForm path={path} teamId={teamId} />
        </div>
      </div>

      {path.purpose && (
        <p className="mt-1.5 text-xs app-copy-soft">{path.purpose}</p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] app-copy-soft uppercase tracking-[0.1em]">
        {path.priority != null && <span>Priority {path.priority}</span>}
        {path.minimumCount != null && <span>Min {path.minimumCount}</span>}
        {path.targetCount != null && <span>Target {path.targetCount}</span>}
        {path.maximumCount != null && <span>Max {path.maximumCount}</span>}
        {path.cooldownRounds != null && <span>Cooldown {path.cooldownRounds}r</span>}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded-full border app-hairline px-3 py-1 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground)]"
          onClick={() => setEditing(true)}
          type="button"
        >
          Edit
        </button>
        <DeleteForm path={path} teamId={teamId} />
      </div>
    </div>
  );
}

function RotationPathEditForm({
  path,
  teamId,
  onCancel,
}: {
  path: RotationPathDetail;
  teamId: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateRotationPathAction, { error: "" });

  return (
    <form action={formAction} className="rounded-xl border border-[var(--accent)]/25 bg-[var(--tl-c-surface)] px-4 py-3">
      {state.error && (
        <div className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-3 py-2 text-xs text-[var(--danger)]">
          {state.error}
        </div>
      )}

      <input name="pathId" type="hidden" defaultValue={path.id} />
      <input name="fromTeamId" type="hidden" defaultValue={path.fromTeamId} />
      <input name="toTeamId" type="hidden" defaultValue={path.toTeamId} />
      <input name="redirectTeamId" type="hidden" defaultValue={teamId} />

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {path.fromTeamName} → {path.toTeamName}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${roleBadgeClasses(path.role)}`}>
          {formatRoleDisplay(path.role)}
        </span>
      </div>

      <label className="mb-3 flex flex-col gap-1.5 text-sm font-medium text-[var(--foreground)]">
        Purpose
        <input
          name="purpose"
          type="text"
          defaultValue={path.purpose ?? ""}
          className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
          disabled={isPending}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--foreground)]">
          Priority
          <input
            name="priority"
            type="number"
            min={0}
            defaultValue={path.priority ?? ""}
            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--foreground)]">
          Cooldown rounds
          <input
            name="cooldownRounds"
            type="number"
            min={0}
            defaultValue={path.cooldownRounds ?? ""}
            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--foreground)]">
          Min count
          <input
            name="minimumCount"
            type="number"
            min={0}
            defaultValue={path.minimumCount ?? ""}
            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--foreground)]">
          Target count
          <input
            name="targetCount"
            type="number"
            min={0}
            defaultValue={path.targetCount ?? ""}
            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--foreground)]">
          Max count
          <input
            name="maximumCount"
            type="number"
            min={0}
            defaultValue={path.maximumCount ?? ""}
            className="h-10 rounded-xl border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
            disabled={isPending}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--foreground)]">
        <input
          name="active"
          type="checkbox"
          defaultChecked={path.active}
          className="h-4 w-4 rounded"
          disabled={isPending}
        />
        Active
      </label>

      <div className="mt-4 flex items-center gap-2">
        <TouchlineButton type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </TouchlineButton>
        <button
          className="rounded-full border app-hairline px-3 py-1 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)]"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}