'use client';

import { useState, useTransition } from 'react';
import { TacticalSurface } from '@/components/ui/tactical-surface';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import {
  DEVELOPMENT_FOCUS_CATEGORIES,
  DEVELOPMENT_FOCUS_CATEGORY_LABELS,
  type DevelopmentFocusCategory,
} from '@/lib/coaching/development-thread-categories';
import {
  createThreadAction,
  completeThreadAction,
  closeThreadAction,
  reopenThreadAction,
  addObservationAction,
  removeObservationAction,
  getActiveThreadsForPlayerAction,
  getThreadsForPlayerAction,
} from '@/app/(app)/matches/development-thread-actions';

type ThreadRow = {
  id: string;
  playerId: string;
  focus: string;
  rationale: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CLOSED';
  category: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;
  closedAt: Date | string | null;
  recordedBy: string | null;
  observations: { id: string; threadId: string; matchId: string | null; evidence: string; context: string | null; recordedBy: string | null; createdAt: Date | string }[];
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
};

function statusVariant(status: string): 'success' | 'neutral' | 'warning' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'COMPLETED') return 'neutral';
  return 'warning';
}

type PlayerDevelopmentThreadsPanelProps = {
  playerId: string;
  threads: ThreadRow[];
};

export function PlayerDevelopmentThreadsPanel({ playerId, threads: initialThreads }: PlayerDevelopmentThreadsPanelProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [showAll, setShowAll] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newFocus, setNewFocus] = useState('');
  const [newCategory, setNewCategory] = useState<DevelopmentFocusCategory | ''>('');
  const [newRationale, setNewRationale] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [obsInput, setObsInput] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  async function refreshThreads() {
    const res = showAll
      ? await getThreadsForPlayerAction(playerId)
      : await getActiveThreadsForPlayerAction(playerId);
    if (res.success && res.threads) {
      setThreads(res.threads as ThreadRow[]);
    }
  }

  async function handleCreate() {
    if (!newFocus.trim()) return;
    setSaving(true);
    const result = await createThreadAction({
      playerId,
      focus: newFocus.trim(),
      category: newCategory || undefined,
      rationale: newRationale.trim() || undefined,
    });
    if (result.success) {
      await refreshThreads();
      setShowNew(false);
      setNewFocus('');
      setNewCategory('');
      setNewRationale('');
    }
    setSaving(false);
  }

  async function handleComplete(threadId: string) {
    startTransition(async () => {
      await completeThreadAction(threadId);
      await refreshThreads();
    });
  }

  async function handleClose(threadId: string) {
    startTransition(async () => {
      await closeThreadAction(threadId);
      await refreshThreads();
    });
  }

  async function handleReopen(threadId: string) {
    startTransition(async () => {
      await reopenThreadAction(threadId);
      await refreshThreads();
    });
  }

  async function handleAddObservation(threadId: string) {
    const evidence = obsInput[threadId]?.trim();
    if (!evidence) return;
    startTransition(async () => {
      const result = await addObservationAction({ threadId, evidence });
      if (result.success) {
        setObsInput((prev) => ({ ...prev, [threadId]: '' }));
        await refreshThreads();
      }
    });
  }

  async function handleRemoveObservation(observationId: string, _threadId: string) {
    startTransition(async () => {
      await removeObservationAction(observationId);
      await refreshThreads();
    });
  }

  const displayedThreads = showAll ? threads : threads.filter((t) => t.status === 'ACTIVE');

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader
        title="Development threads"
        description="Coach-facing focus areas. Evidence does not mutate attributes automatically."
      />
      <div className="mt-1.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setShowNew(!showNew)}>
              {showNew ? 'Cancel' : 'Add thread'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAll(!showAll);
                startTransition(async () => {
                  const res = await getThreadsForPlayerAction(playerId);
                  if (res.success && res.threads) setThreads(res.threads as ThreadRow[]);
                });
              }}
            >
              {showAll ? 'Active only' : 'Show all'}
            </Button>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {threads.filter((t) => t.status === 'ACTIVE').length}/3 active
          </span>
        </div>

        {showNew && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-2.5">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Focus statement (required)"
                value={newFocus}
                onChange={(e) => setNewFocus(e.target.value)}
                maxLength={200}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface-default)] px-2 py-1.5 text-sm"
                disabled={saving}
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as DevelopmentFocusCategory | '')}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface-default)] px-2 py-1.5 text-sm"
                disabled={saving}
              >
                <option value="">No category</option>
                {DEVELOPMENT_FOCUS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {DEVELOPMENT_FOCUS_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Rationale (optional)"
                value={newRationale}
                onChange={(e) => setNewRationale(e.target.value)}
                maxLength={1000}
                rows={2}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface-default)] px-2 py-1.5 text-sm"
                disabled={saving}
              />
              <Button size="sm" onClick={handleCreate} disabled={saving || !newFocus.trim()}>
                Create thread
              </Button>
            </div>
          </div>
        )}

        {displayedThreads.length === 0 && !showNew && (
          <p className="text-sm text-[var(--text-muted)]">
            {showAll ? 'No development threads.' : 'No active development threads.'}
          </p>
        )}

        {displayedThreads.map((thread) => (
          <div key={thread.id} className="rounded-md border border-[var(--border)] bg-[var(--surface-default)] p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{thread.focus}</span>
                  <StatusPill variant={statusVariant(thread.status)} size="sm">{STATUS_LABELS[thread.status] ?? thread.status}</StatusPill>
                </div>
                {thread.category && (
                  <span className="text-xs text-[var(--text-muted)]">{DEVELOPMENT_FOCUS_CATEGORY_LABELS[thread.category as DevelopmentFocusCategory]}</span>
                )}
                {thread.rationale && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{thread.rationale}</p>
                )}
              </div>
              <div className="flex gap-1">
                {thread.status === 'ACTIVE' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => handleComplete(thread.id)} disabled={isPending}>
                      Complete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleClose(thread.id)} disabled={isPending}>
                      Close
                    </Button>
                  </>
                )}
                {(thread.status === 'COMPLETED' || thread.status === 'CLOSED') && (
                  <Button size="sm" variant="secondary" onClick={() => handleReopen(thread.id)} disabled={isPending}>
                    Reopen
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-1.5">
              <button
                type="button"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setExpandedThread(expandedThread === thread.id ? null : thread.id)}
              >
                {thread.observations.length} observation{thread.observations.length !== 1 ? 's' : ''}
                {expandedThread === thread.id ? ' (hide)' : ' (show)'}
              </button>
            </div>

            {expandedThread === thread.id && (
              <div className="mt-2 flex flex-col gap-1.5">
                {thread.observations.map((obs) => (
                  <div key={obs.id} className="flex items-start justify-between rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5">
                    <div className="flex-1">
                      <p className="text-sm">{obs.evidence}</p>
                      {obs.context && <p className="text-xs text-[var(--text-muted)]">{obs.context}</p>}
                    </div>
                    {thread.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="ml-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                        onClick={() => handleRemoveObservation(obs.id, thread.id)}
                        disabled={isPending}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}

                {thread.status === 'ACTIVE' && (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Add evidence..."
                      value={obsInput[thread.id] ?? ''}
                      onChange={(e) => setObsInput((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                      maxLength={1000}
                      className="flex-1 rounded border border-[var(--border)] bg-[var(--surface-default)] px-2 py-1 text-sm"
                      disabled={isPending}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddObservation(thread.id);
                      }}
                    />
                    <Button size="sm" variant="secondary" onClick={() => handleAddObservation(thread.id)} disabled={isPending || !(obsInput[thread.id]?.trim())}>
                      Add
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </TacticalSurface>
  );
}