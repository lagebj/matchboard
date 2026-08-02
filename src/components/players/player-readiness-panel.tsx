'use client';

import { useState } from 'react';
import { TacticalSurface } from '@/components/ui/tactical-surface';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import {
  READINESS_SIGNAL_LABELS,
  READINESS_SIGNAL_VALID_VALUES,
  READINESS_VALUE_LABELS,
  type ReadinessSignalType,
  type ReadinessSignalValue,
} from '@/lib/coaching/types';
import { setReadinessSignalAction, deleteReadinessSignalAction, getReadinessSignalsAction } from '@/app/(app)/players/[playerId]/coaching-actions/actions';

type ReadinessSignalRow = {
  id: string;
  signalType: string;
  value: string;
  note: string | null;
};

type PlayerReadinessPanelProps = {
  playerId: string;
  signals: ReadinessSignalRow[];
};

function valueVariant(value: ReadinessSignalValue): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'RISING' || value === 'HIGH' || value === 'STRONG') return 'success';
  if (value === 'FALLING' || value === 'LOW') return 'danger';
  if (value === 'NEEDS_ATTENTION' || value === 'MEDIUM') return 'warning';
  return 'neutral';
}

export function PlayerReadinessPanel({ playerId, signals: initialSignals }: PlayerReadinessPanelProps) {
  const [signals, setSignals] = useState(initialSignals);
  const [editingType, setEditingType] = useState<ReadinessSignalType | null>(null);
  const [editValue, setEditValue] = useState<ReadinessSignalValue>('STABLE');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  const signalMap = new Map(signals.map((s) => [s.signalType, s]));

  async function handleSet(type: ReadinessSignalType) {
    setSaving(true);
    const result = await setReadinessSignalAction(playerId, type, editValue, editNote || null);
    if (result.success) {
      const updated = await fetchSignals();
      if (updated) setSignals(updated);
      setEditingType(null);
    }
    setSaving(false);
  }

  async function handleDelete(type: ReadinessSignalType) {
    setSaving(true);
    const result = await deleteReadinessSignalAction(playerId, type);
    if (result.success) {
      const updated = await fetchSignals();
      if (updated) setSignals(updated);
    }
    setSaving(false);
  }

  async function fetchSignals(): Promise<ReadinessSignalRow[] | null> {
    try {
      const res = await getReadinessSignalsAction(playerId);
      return res.success ? res.signals ?? null : null;
    } catch {
      return null;
    }
  }

  return (
    <TacticalSurface variant="default" padding="sm">
      <SectionHeader title="Readiness signals" description="Coach-facing planning context. Not shown in parent exports." />
      <div className="mt-1.5 flex flex-col gap-2">
        {(Object.entries(READINESS_SIGNAL_LABELS) as [ReadinessSignalType, string][]).map(([type, label]) => {
          const existing = signalMap.get(type);
          const isEditing = editingType === type;

          if (isEditing) {
            const validValues = READINESS_SIGNAL_VALID_VALUES[type];
            return (
              <div key={type} className="flex flex-col gap-1.5 py-1.5 px-2 rounded bg-[var(--surface-muted)]/40">
                <span className="text-xs font-medium text-zinc-200">{label}</span>
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value as ReadinessSignalValue)}
                  className="text-sm bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1"
                >
                  {validValues.map((v) => (
                    <option key={v} value={v}>{READINESS_VALUE_LABELS[v]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Optional note"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="text-sm bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleSet(type)} disabled={saving}>
                    {existing ? 'Update' : 'Set'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingType(null)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              </div>
            );
          }

          if (existing) {
            const variant = valueVariant(existing.value as ReadinessSignalValue);
            const colorClass = variant === 'danger' ? 'text-[var(--danger)]' : variant === 'warning' ? 'text-[var(--warning)]' : variant === 'success' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]';
            return (
              <div key={type} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-muted)]/30">
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-medium text-zinc-200">{label}</span>
                  {existing.note && <span className="text-[10px] text-[var(--text-muted)] line-clamp-1">{existing.note}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold ${colorClass}`}>
                    {READINESS_VALUE_LABELS[existing.value as ReadinessSignalValue]}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingType(type); setEditValue(existing.value as ReadinessSignalValue); setEditNote(existing.note ?? ''); }}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(type)} disabled={saving}>
                    Clear
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div key={type} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-[var(--surface-muted)]/30">
              <span className="text-xs text-[var(--text-muted)]">{label}</span>
              <Button size="sm" variant="ghost" onClick={() => { setEditingType(type); setEditValue(READINESS_SIGNAL_VALID_VALUES[type][0]); setEditNote(''); }}>
                Set
              </Button>
            </div>
          );
        })}
      </div>
    </TacticalSurface>
  );
}