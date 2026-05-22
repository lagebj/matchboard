"use client";

import { useState } from "react";
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

function roleBadgeClasses(role: string): string {
  switch (role) {
    case "SUPPORT": return "border-[rgba(178,140,219,0.24)] bg-[rgba(178,140,219,0.08)] text-[#c0a0db]";
    case "DEVELOPMENT": return "border-[rgba(140,167,146,0.24)] bg-[rgba(140,167,146,0.08)] text-[var(--accent-strong)]";
    case "BACKFILL": return "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] text-[var(--warning)]";
    default: return "border-app-hairline bg-[rgba(255,255,255,0.04)] app-copy-soft";
  }
}

function ToggleActiveForm({ path, teamId }: { path: RotationPathDetail; teamId: string }) {
  const [state, formAction, isPending] = useActionState(toggleRotationPathActiveAction, { error: "" });

  return (
    <form action={formAction}>
      <input name="pathId" type="hidden" defaultValue={path.id} />
      <input name="redirectTeamId" type="hidden" defaultValue={teamId} />
      {state.error && (
        <p className="mb-2 text-xs text-[#f0cbc5]">{state.error}</p>
      )}
      <button
        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
          path.active
            ? "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)] hover:bg-[rgba(140,167,146,0.2)]"
            : "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.16)]"
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
        <span className="text-xs text-[#f0cbc5]">Delete this path?</span>
        <form action={formAction}>
          <input name="pathId" type="hidden" defaultValue={path.id} />
          <input name="redirectTeamId" type="hidden" defaultValue={teamId} />
          <button
            className="rounded-full border border-[rgba(185,128,119,0.4)] bg-[rgba(185,128,119,0.12)] px-3 py-1 text-xs font-medium text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.2)]"
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
          {state.error && <p className="mt-1 text-xs text-[#f0cbc5]">{state.error}</p>}
        </form>
      </div>
    );
  }

  return (
    <button
      className="rounded-full border app-hairline px-3 py-1 text-xs app-copy-soft hover:bg-[rgba(185,128,119,0.08)] hover:text-[#f0cbc5]"
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
    <div className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100">{direction === "outgoing" ? path.toTeamName : path.fromTeamName}</span>
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
          className="rounded-full border app-hairline px-3 py-1 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
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
    <form action={formAction} className="rounded-xl border border-[rgba(140,167,146,0.24)] bg-[rgba(0,0,0,0.14)] px-4 py-3">
      {state.error && (
        <div className="mb-3 rounded-xl border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-3 py-2 text-xs text-[#f0cbc5]">
          {state.error}
        </div>
      )}

      <input name="pathId" type="hidden" defaultValue={path.id} />
      <input name="fromTeamId" type="hidden" defaultValue={path.fromTeamId} />
      <input name="toTeamId" type="hidden" defaultValue={path.toTeamId} />
      <input name="redirectTeamId" type="hidden" defaultValue={teamId} />

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-100">
          {path.fromTeamName} → {path.toTeamName}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${roleBadgeClasses(path.role)}`}>
          {formatRoleDisplay(path.role)}
        </span>
      </div>

      <label className="mb-3 flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
        Purpose
        <input
          name="purpose"
          type="text"
          defaultValue={path.purpose ?? ""}
          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
          disabled={isPending}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
          Priority
          <input
            name="priority"
            type="number"
            min={0}
            defaultValue={path.priority ?? ""}
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
          Cooldown rounds
          <input
            name="cooldownRounds"
            type="number"
            min={0}
            defaultValue={path.cooldownRounds ?? ""}
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
          Min count
          <input
            name="minimumCount"
            type="number"
            min={0}
            defaultValue={path.minimumCount ?? ""}
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
          Target count
          <input
            name="targetCount"
            type="number"
            min={0}
            defaultValue={path.targetCount ?? ""}
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-100">
          Max count
          <input
            name="maximumCount"
            type="number"
            min={0}
            defaultValue={path.maximumCount ?? ""}
            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
            disabled={isPending}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-100">
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
        <button
          className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
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