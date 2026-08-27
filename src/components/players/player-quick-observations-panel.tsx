'use client';

import { useState, useTransition } from 'react';
import { TacticalSurface } from '@/components/ui/tactical-surface';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import {
  createQuickObservationAction,
  discardQuickObservationAction,
  keepQuickObservationAsNoteAction,
  convertQuickObservationAction,
} from '@/app/(app)/matches/quick-observation-actions';
import { getActiveThreadsForPlayerAction } from '@/app/(app)/matches/development-thread-actions';

type QuickObservationRow = {
  id: string;
  matchId: string | null;
  playerIds: string[];
  note: string;
  status: 'OPEN' | 'CONVERTED' | 'KEPT_AS_NOTE' | 'DISCARDED';
  convertedToType: string | null;
  createdAt: Date | string;
};

type ActiveThread = { id: string; focus: string };

type PlayerQuickObservationsPanelProps = {
  playerId: string;
  observations: QuickObservationRow[];
};

// Capture-first, classify-later (Phase 8, DECISIONS.md "Quick observations"). This panel keeps
// capture deliberately minimal — a note tied to this player, no required match/classification —
// and only exposes the "convert to development thread" path, since that's the one conversion
// target meaningful without a match context. Team-reflection/opponent-observation conversion
// (which need a match) are reached from a match-scoped surface, not here.
export function PlayerQuickObservationsPanel({ playerId, observations: initialObservations }: PlayerQuickObservationsPanelProps) {
  const [observations, setObservations] = useState(initialObservations);
  const [showCapture, setShowCapture] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [activeThreads, setActiveThreads] = useState<ActiveThread[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const openObservations = observations.filter((o) => o.status === 'OPEN');

  async function handleCapture() {
    if (!note.trim()) return;
    setSaving(true);
    const result = await createQuickObservationAction({ note: note.trim(), playerIds: [playerId] });
    if (result.success) {
      setObservations((prev) => [result.observation, ...prev]);
      setNote('');
      setShowCapture(false);
    }
    setSaving(false);
  }

  function handleDiscard(id: string) {
    startTransition(async () => {
      const result = await discardQuickObservationAction(id);
      if (result.success) {
        setObservations((prev) => prev.map((o) => (o.id === id ? result.observation : o)));
      }
    });
  }

  function handleKeep(id: string) {
    startTransition(async () => {
      const result = await keepQuickObservationAsNoteAction(id);
      if (result.success) {
        setObservations((prev) => prev.map((o) => (o.id === id ? result.observation : o)));
      }
    });
  }

  async function startConvert(id: string) {
    setConvertingId(id);
    if (!activeThreads) {
      const res = await getActiveThreadsForPlayerAction(playerId);
      if (res.success && res.threads) {
        setActiveThreads(res.threads.map((t) => ({ id: t.id, focus: t.focus })));
      } else {
        setActiveThreads([]);
      }
    }
  }

  function handleConvertToThread(id: string, threadId: string) {
    startTransition(async () => {
      const result = await convertQuickObservationAction(id, { type: 'DEVELOPMENT_THREAD', threadId });
      if (result.success) {
        setObservations((prev) => prev.map((o) => (o.id === id ? result.observation : o)));
        setConvertingId(null);
      }
    });
  }

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader
        title="Quick observations"
        description="Capture now, classify later. No AI — the coach decides what a note becomes."
      />
      <div className="mt-1.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Button size="sm" variant="secondary" onClick={() => setShowCapture(!showCapture)}>
            {showCapture ? 'Cancel' : 'Add note'}
          </Button>
          <span className="text-xs text-[var(--text-muted)]">{openObservations.length} open</span>
        </div>

        {showCapture && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-2.5">
            <div className="flex flex-col gap-2">
              <textarea
                placeholder="What did you notice?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={2}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface-default)] px-2 py-1.5 text-sm"
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCapture();
                }}
              />
              <Button size="sm" onClick={handleCapture} disabled={saving || !note.trim()}>
                Save note
              </Button>
            </div>
          </div>
        )}

        {openObservations.length === 0 && !showCapture && (
          <p className="text-sm text-[var(--text-muted)]">No open quick observations.</p>
        )}

        {openObservations.map((obs) => (
          <div key={obs.id} className="rounded-md border border-[var(--border)] bg-[var(--surface-default)] p-2.5">
            <p className="text-sm">{obs.note}</p>

            {convertingId === obs.id ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {activeThreads === null ? (
                  <span className="text-xs text-[var(--text-muted)]">Loading threads…</span>
                ) : activeThreads.length === 0 ? (
                  <span className="text-xs text-[var(--text-muted)]">No active development threads for this player.</span>
                ) : (
                  activeThreads.map((t) => (
                    <Button key={t.id} size="sm" variant="secondary" onClick={() => handleConvertToThread(obs.id, t.id)} disabled={isPending}>
                      {t.focus}
                    </Button>
                  ))
                )}
                <Button size="sm" variant="ghost" onClick={() => setConvertingId(null)} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="mt-1.5 flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => startConvert(obs.id)} disabled={isPending}>
                  Link to thread
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleKeep(obs.id)} disabled={isPending}>
                  Keep as note
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDiscard(obs.id)} disabled={isPending}>
                  Discard
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </TacticalSurface>
  );
}
