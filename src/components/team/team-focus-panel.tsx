"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Target, Plus, Check, X, RotateCcw, Pencil } from "lucide-react";
import {
  createTeamFocusAction,
  updateTeamFocusAction,
  completeTeamFocusAction,
  closeTeamFocusAction,
  reopenTeamFocusAction,
  getTeamFocusesForTeamAction,
} from "@/app/(app)/o/[orgSlug]/teams/team-focus-actions";
import type { TeamFocusStatus } from "@/lib/coaching/team-focus";

type TeamFocusRow = {
  id: string;
  statement: string;
  context: string | null;
  status: TeamFocusStatus;
  startedAt: string;
  completedAt: string | null;
  closedAt: string | null;
  linkedIntentId: string | null;
};

const STATUS_LABELS: Record<TeamFocusStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CLOSED: "Closed",
};

const STATUS_COLORS: Record<TeamFocusStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CLOSED: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function TeamFocusPanel({
  teamId,
  initialFocuses,
}: {
  teamId: string;
  initialFocuses: TeamFocusRow[];
}) {
  const [focuses, setFocuses] = useState<TeamFocusRow[]>(initialFocuses);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStatement, setNewStatement] = useState("");
  const [newContext, setNewContext] = useState("");
  const [editStatement, setEditStatement] = useState("");
  const [editContext, setEditContext] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const result = await getTeamFocusesForTeamAction(teamId);
      if (result.success && result.focuses) {
        setFocuses(result.focuses.map((f) => ({
          ...f,
          status: f.status as TeamFocusStatus,
          startedAt: f.startedAt instanceof Date ? f.startedAt.toISOString() : String(f.startedAt),
          completedAt: f.completedAt instanceof Date ? f.completedAt.toISOString() : f.completedAt ? String(f.completedAt) : null,
          closedAt: f.closedAt instanceof Date ? f.closedAt.toISOString() : f.closedAt ? String(f.closedAt) : null,
        })));
      }
    });
  };

  const handleCreate = () => {
    if (!newStatement.trim()) return;
    startTransition(async () => {
      const result = await createTeamFocusAction({
        teamId,
        statement: newStatement.trim(),
        context: newContext.trim() || undefined,
      });
      if (result.success) {
        setAdding(false);
        setNewStatement("");
        setNewContext("");
        refresh();
      }
    });
  };

  const handleEdit = (focusId: string) => {
    if (!editStatement.trim()) return;
    startTransition(async () => {
      const result = await updateTeamFocusAction(focusId, {
        statement: editStatement.trim(),
        context: editContext.trim() || undefined,
      });
      if (result.success) {
        setEditingId(null);
        refresh();
      }
    });
  };

  const handleComplete = (focusId: string) => {
    startTransition(async () => {
      await completeTeamFocusAction(focusId);
      refresh();
    });
  };

  const handleClose = (focusId: string) => {
    startTransition(async () => {
      await closeTeamFocusAction(focusId);
      refresh();
    });
  };

  const handleReopen = (focusId: string) => {
    startTransition(async () => {
      await reopenTeamFocusAction(focusId);
      refresh();
    });
  };

  const activeFocuses = focuses.filter((f) => f.status === "ACTIVE");
  const pastFocuses = focuses.filter((f) => f.status !== "ACTIVE");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Team focus" />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setAdding(true);
            setNewStatement("");
            setNewContext("");
          }}
          disabled={adding || pending}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add focus
        </Button>
      </div>

      {activeFocuses.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          No active focus blocks. Add a focus to track what the team is working on.
        </p>
      )}

      {adding && (
        <Surface variant="raised" padding="md" className="space-y-3">
          <div>
            <label className="text-sm font-medium">Statement</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Build from the back"
              maxLength={300}
              value={newStatement}
              onChange={(e) => setNewStatement(e.target.value)}
              disabled={pending}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Context (optional)</label>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Why this focus matters right now"
              maxLength={1000}
              rows={2}
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={pending || !newStatement.trim()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </Surface>
      )}

      {activeFocuses.map((focus) => (
        <Surface key={focus.id} variant="raised" padding="md">
          {editingId === focus.id ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Statement</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={300}
                  value={editStatement}
                  onChange={(e) => setEditStatement(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Context (optional)</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={1000}
                  rows={2}
                  value={editContext}
                  onChange={(e) => setEditContext(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleEdit(focus.id)} disabled={pending || !editStatement.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-sm">{focus.statement}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[focus.status]}`}>
                    {STATUS_LABELS[focus.status]}
                  </span>
                </div>
                {focus.context && (
                  <p className="mt-1 text-sm text-muted-foreground">{focus.context}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Started {formatDate(focus.startedAt)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(focus.id);
                    setEditStatement(focus.statement);
                    setEditContext(focus.context ?? "");
                  }}
                  disabled={pending}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleComplete(focus.id)}
                  disabled={pending}
                  title="Mark completed"
                >
                  <Check className="h-3.5 w-3.5 text-blue-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleClose(focus.id)}
                  disabled={pending}
                  title="Close"
                >
                  <X className="h-3.5 w-3.5 text-gray-500" />
                </Button>
              </div>
            </div>
          )}
        </Surface>
      ))}

      {pastFocuses.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Past focus ({pastFocuses.length})
          </summary>
          <div className="mt-2 space-y-2">
            {pastFocuses.map((focus) => (
              <Surface key={focus.id} variant="subtle" padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-sm">{focus.statement}</span>
                    <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[focus.status]}`}>
                      {STATUS_LABELS[focus.status]}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(focus.startedAt)}
                      {focus.completedAt ? ` — completed ${formatDate(focus.completedAt)}` : ""}
                      {focus.closedAt ? ` — closed ${formatDate(focus.closedAt)}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReopen(focus.id)}
                    disabled={pending}
                    title="Reopen"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Surface>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}