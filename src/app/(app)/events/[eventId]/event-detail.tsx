'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  generateEventSquadsAction,
  clearEventSquadsAction,
  deleteEventAction,
  updateEventPlayerAvailability,
  movePlayerBetweenSquadsAction,
  togglePlayerLockAction,
} from '../actions';
import type { EventPlayerStatus } from '@/generated/prisma/client';
import { PageHeader } from '@/components/ui/page-header';
import { TabRail } from '@/components/ui/tab-rail';
import { Surface } from '@/components/ui/surface';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Button } from '@/components/ui/button';
import { MetricTile } from '@/components/ui/metric-tile';
import { DecisionBanner } from '@/components/ui/decision-banner';

type EventSquad = {
  id: string;
  name: string;
  intent: string;
  targetSize: number;
  minSize: number | null;
  maxSize: number | null;
  formationId: string | null;
  generationOrder: number;
  players: {
    id: string;
    playerId: string;
    source: string;
    locked: boolean;
    selectionReason: string;
    firstName: string;
    lastName: string | null;
    coreTeamId: string | null;
    primaryPosition: string | null;
    goalkeeperAbility: string | null;
    isGK: boolean;
  }[];
};

type EventPlayer = {
  playerId: string;
  status: string;
  firstName: string;
  lastName: string | null;
  coreTeamId: string | null;
  coreTeamName: string | null;
  primaryPosition: string | null;
  goalkeeperAbility: string;
  overallLevel: number | null;
  isGK: boolean;
  assignedSquadId: string | null;
};

type EventDetailData = {
  id: string;
  name: string;
  eventType: string;
  startsAt: string;
  endsAt: string | null;
  gameFormat: string;
  selectionPattern: string | null;
  notes: string | null;
  defaultFormationId: string | null;
  squads: EventSquad[];
  players: EventPlayer[];
  availablePlayers: EventPlayer[];
  unassignedPlayers: EventPlayer[];
};

type TabKey = 'overview' | 'squads' | 'availability';

const EVENT_TYPE_LABELS: Record<string, string> = {
  CUP: 'Cup',
  TOURNAMENT: 'Tournament',
  FRIENDLY_DAY: 'Friendly day',
  OTHER: 'Other',
};

const INTENT_LABELS: Record<string, string> = {
  COMPETITIVE: 'Competitive',
  BALANCED: 'Balanced',
  MANUAL: 'Manual',
};

const PATTERN_LABELS: Record<string, string> = {
  ALL_BALANCED: 'All squads balanced',
  ONE_COMPETITIVE_BALANCED_REMAINDER: 'One competitive + balanced remainder',
  MANUAL_SEED_AUTO_BALANCE: 'Manual seed + auto balance',
};

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  AVAILABLE: 'success',
  UNAVAILABLE: 'danger',
  UNKNOWN: 'neutral',
  RESERVE: 'info',
  LATE_ADDITION: 'warning',
  WITHDRAWN: 'danger',
};

function formatName(p: { firstName: string; lastName: string | null }): string {
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

function formatGameFormat(gf: string): string {
  return gf.replace('_', '-').toLowerCase();
}

export function EventDetail({ data }: { data: EventDetailData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');

  const totalAssigned = data.squads.reduce((sum, s) => sum + s.players.length, 0);
  const totalAvailable = data.availablePlayers.length;
  const totalUnassigned = data.unassignedPlayers.length;

  function handleGenerate() {
    startTransition(async () => {
      await generateEventSquadsAction(data.id);
      router.refresh();
    });
  }

  function handleClear() {
    if (!confirm('Clear all generated squad assignments? Locked players will be kept.')) return;
    startTransition(async () => {
      await clearEventSquadsAction(data.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${data.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteEventAction(data.id);
      router.push('/events');
    });
  }

  function handleAvailabilityChange(playerId: string, status: string) {
    startTransition(async () => {
      await updateEventPlayerAvailability(data.id, playerId, status as EventPlayerStatus);
      router.refresh();
    });
  }

  function handleMovePlayer(playerId: string, fromSquadId: string, toSquadId: string) {
    startTransition(async () => {
      await movePlayerBetweenSquadsAction(playerId, fromSquadId, toSquadId);
      router.refresh();
    });
  }

  function handleToggleLock(squadPlayerId: string, locked: boolean) {
    startTransition(async () => {
      await togglePlayerLockAction(squadPlayerId, locked);
      router.refresh();
    });
  }

  const filteredPlayers = availabilityFilter === 'all'
    ? data.players
    : data.players.filter((p) => p.status === availabilityFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        description={`${EVENT_TYPE_LABELS[data.eventType] ?? data.eventType} · ${formatGameFormat(data.gameFormat)} · ${new Date(data.startsAt).toLocaleDateString()}`}
        actions={
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleGenerate} disabled={isPending}>
              {isPending ? 'Generating...' : 'Generate squads'}
            </Button>
            <Button variant="secondary" onClick={handleClear} disabled={isPending}>
              Clear
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
            <Link href="/events">
              <Button variant="ghost">Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Squads" value={data.squads.length} />
        <MetricTile label="Available" value={totalAvailable} />
        <MetricTile label="Assigned" value={totalAssigned} />
        <MetricTile label="Unassigned" value={totalUnassigned} />
      </div>

      {data.selectionPattern && (
        <DecisionBanner
          variant="note"
          title="Selection pattern"
          description={PATTERN_LABELS[data.selectionPattern] ?? data.selectionPattern}
        />
      )}

      <TabRail
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'squads', label: 'Squads' },
          { key: 'availability', label: 'Availability' },
        ]}
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key as TabKey)}
        variant="pill"
      />

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Surface variant="default" padding="md">
            <SectionHeader title="Event details" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Type</p>
                <p className="text-sm text-zinc-100">{EVENT_TYPE_LABELS[data.eventType] ?? data.eventType}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Game format</p>
                <p className="text-sm text-zinc-100">{formatGameFormat(data.gameFormat)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Starts</p>
                <p className="text-sm text-zinc-100">{new Date(data.startsAt).toLocaleDateString()}</p>
              </div>
              {data.endsAt && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Ends</p>
                  <p className="text-sm text-zinc-100">{new Date(data.endsAt).toLocaleDateString()}</p>
                </div>
              )}
              {data.notes && (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Notes</p>
                  <p className="text-sm text-[var(--text-soft)] whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
            </div>
          </Surface>

          <Surface variant="default" padding="md">
            <SectionHeader title="Squad summary" />
            <div className="mt-3 space-y-3">
              {data.squads.map((squad) => (
                <div key={squad.id} className="rounded-lg border border-[var(--border-soft)] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-zinc-100">{squad.name}</span>
                      <StatusPill variant="neutral" className="ml-2">{INTENT_LABELS[squad.intent] ?? squad.intent}</StatusPill>
                    </div>
                    <span className="text-sm text-[var(--text-muted)]">
                      {squad.players.length}/{squad.targetSize}
                    </span>
                  </div>
                  {squad.players.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {squad.players.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-zinc-200"
                        >
                          {formatName(p)}
                          {p.locked && <span className="ml-1 text-[var(--accent)]">🔒</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}

      {activeTab === 'squads' && (
        <div className="space-y-4">
          {data.squads.length === 0 ? (
            <Surface variant="default" padding="md">
              <p className="text-sm text-[var(--text-muted)]">No squads configured. Add squads to start planning.</p>
            </Surface>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="space-y-2">
                <SectionHeader title="Unassigned" />
                <div className="space-y-1">
                  {data.unassignedPlayers.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">All available players assigned</p>
                  ) : (
                    data.unassignedPlayers.map((p) => (
                      <div
                        key={p.playerId}
                        className="flex items-center gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-100 truncate">{formatName(p)}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {p.primaryPosition ?? 'flexible'} · {p.overallLevel !== null ? p.overallLevel.toFixed(1) : '—'}
                            {p.isGK && ' · GK'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {data.squads.map((squad) => (
                  <Surface key={squad.id} variant="default" padding="md">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm font-semibold text-zinc-100">{squad.name}</span>
                        <StatusPill variant="neutral" className="ml-2">{INTENT_LABELS[squad.intent] ?? squad.intent}</StatusPill>
                      </div>
                      <span className="text-sm text-[var(--text-muted)]">
                        {squad.players.length}/{squad.targetSize}
                      </span>
                    </div>
                    {squad.players.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">No players assigned yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {squad.players.map((p) => (
                          <div
                            key={p.id}
                            className="group relative inline-flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 py-1 text-sm text-zinc-200 hover:border-[var(--accent)]/50 transition-colors"
                          >
                            <span>{formatName(p)}</span>
                            {p.locked && <span className="text-[var(--accent)] text-[10px]">🔒</span>}
                            {p.isGK && <span className="text-[10px] text-[var(--text-muted)]">GK</span>}
                            <div className="invisible group-hover:visible flex gap-1 ml-1">
                              {!p.locked && (
                                <button
                                  onClick={() => handleToggleLock(p.id, true)}
                                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                                  title="Lock player"
                                >
                                  Lock
                                </button>
                              )}
                              {p.locked && (
                                <button
                                  onClick={() => handleToggleLock(p.id, false)}
                                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                                  title="Unlock player"
                                >
                                  Unlock
                                </button>
                              )}
                              {data.squads.length > 1 && (
                                <select
                                  className="text-[10px] bg-[var(--surface-base)] border border-[var(--border-soft)] rounded px-1"
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleMovePlayer(p.playerId, squad.id, e.target.value);
                                    }
                                  }}
                                >
                                  <option value="" disabled>Move to...</option>
                                  {data.squads.filter((s) => s.id !== squad.id).map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Surface>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'availability' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['all', 'AVAILABLE', 'UNAVAILABLE', 'UNKNOWN', 'RESERVE', 'WITHDRAWN'].map((filter) => (
              <button
                key={filter}
                onClick={() => setAvailabilityFilter(filter)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  availabilityFilter === filter
                    ? 'bg-[var(--accent)] text-zinc-950'
                    : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {filter === 'all' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase().replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <Surface variant="default" padding="md">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-soft)]">
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Player</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Team</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Position</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Overall</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Status</th>
                    <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Squad</th>
                    <th className="text-right py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((p) => (
                    <tr key={p.playerId} className="border-b border-[var(--border-soft)]/50 hover:bg-[var(--surface-hover)]">
                      <td className="py-2 px-2">
                        <Link href={`/players/${p.playerId}`} className="text-zinc-100 hover:text-[var(--accent-strong)]">
                          {formatName(p)}
                        </Link>
                      </td>
                      <td className="py-2 px-2 text-[var(--text-soft)]">{p.coreTeamName ?? '—'}</td>
                      <td className="py-2 px-2 text-[var(--text-soft)]">{p.primaryPosition ?? '—'}</td>
                      <td className="py-2 px-2 text-zinc-100 tabular-nums">{p.overallLevel !== null ? p.overallLevel.toFixed(1) : '—'}</td>
                      <td className="py-2 px-2">
                        <StatusPill variant={STATUS_VARIANTS[p.status] ?? 'neutral'}>
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase().replace(/_/g, ' ')}
                        </StatusPill>
                      </td>
                      <td className="py-2 px-2 text-[var(--text-soft)]">
                        {p.assignedSquadId
                          ? data.squads.find((s) => s.id === p.assignedSquadId)?.name ?? '—'
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <select
                          className="text-xs bg-[var(--surface-base)] border border-[var(--border-soft)] rounded px-1.5 py-0.5"
                          value={p.status}
                          onChange={(e) => handleAvailabilityChange(p.playerId, e.target.value)}
                        >
                          <option value="AVAILABLE">Available</option>
                          <option value="UNAVAILABLE">Unavailable</option>
                          <option value="UNKNOWN">Unknown</option>
                          <option value="RESERVE">Reserve</option>
                          <option value="LATE_ADDITION">Late addition</option>
                          <option value="WITHDRAWN">Withdrawn</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}