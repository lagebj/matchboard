"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { GOAL_DETAIL_INACTIVITY_TIMEOUT_MS } from "@/lib/live-match/live-match-types";
import {
  createInitialClockState,
  getElapsedMs,
  formatElapsedMs,
  advancePeriod,
  isPlayingPeriod,
  isMatchOver,
  isBreakPeriod,
  getPeriodAfter,
} from "@/lib/live-match/match-clock";
import { getEventTypeLabel, getFairPlayCategoryLabel } from "@/lib/live-match/live-match-domain";
import type { LiveEventSummary, MatchClockState } from "@/lib/live-match/live-match-types";
import type { PeriodConfig } from "@/lib/live-match/period-config";
// The one canonical exact-position vocabulary (ADR-0129) — reused here, not re-implemented, for
// the "Position" live-reporting action (recording a POSITIONS_CHANGED event for an on-field
// player who moves without a substitution).
import { EXACT_ROLES } from "@/domain/positions";
import {
  reconcileFromServerEvents,
} from "@/lib/live-match/live-match-reconciliation";
import {
  saveEventLocally,
  markEventSynced,
  getUnsyncedEvents,
  getAllLocalEvents,
  saveSessionLocally,
  clearLocalEvents,
  clearLocalSession,
  type LocalEvent,
} from "@/lib/live-match/local/live-local-store";

export interface SquadPlayer {
  playerId: string;
  playerName: string;
  position: string | null;
  shirtNumber: number | null;
  role: string;
  availability: string;
  startingOnField: boolean;
  slotLabel: string | null;
  // League Match helpers only (ADR-0077) — a player added to this specific match without
  // changing their normal League Round team assignment. Absent/false for event matches and for
  // a League match's own normal squad.
  isHelper?: boolean;
  helperSourceTeamName?: string | null;
  // Match-specific player absence (League matches only, production consistency pass item #3).
  // Undefined/true means the player is an active participant. `false` means the coach marked
  // them Away/Sick/No-show/Declined for this specific match — they must be excluded from
  // scorer/assist selection and on-pitch actions, but the round/team assignment is untouched.
  isActiveParticipant?: boolean;
}

export interface LiveMatchActions {
  startSession: (matchId: string) => Promise<{ success: boolean; data?: { id: string }; error?: string }>;
  endSession: (sessionId: string) => Promise<{ success: boolean; data?: { reportId?: string; reportStatus?: string }; error?: string }>;
  heartbeat: (sessionId: string) => Promise<void>;
  recordEvent: (input: {
    matchId: string;
    sessionId: string;
    eventType: string;
    clientEventId: string;
    period?: string;
    matchSeconds?: number;
    playerId?: string;
    secondaryPlayerId?: string;
    payload?: Record<string, unknown>;
    correctionType?: string;
    correctsEventId?: string;
  }) => Promise<{ success: boolean; error?: string; data?: { id?: string } }>;
  getRecentEvents: (matchId: string, limit?: number) => Promise<{ success: boolean; data?: LiveEventSummary[]; error?: string }>;
  getPreMatchPackage: (matchId: string) => Promise<{
    success: boolean;
    data?: {
      squad: SquadPlayer[];
      activeSession: {
        id: string;
        coachId: string;
        startedAt: string;
        /** Persisted match clock (ADR-0133 H2), serialized. */
        clock?: { period: string; running: boolean; startedAt: string | null; elapsedBeforeStartMs: number };
      } | null;
    };
    error?: string;
  }>;
  /** Persist the match clock on a transition (ADR-0133 H2). Best-effort; optional so non-League
   * clients that don't wire it are unaffected. */
  persistClock?: (sessionId: string, clock: MatchClockState) => Promise<{ success: boolean; error?: string }>;
  reportUrl?: (reportId: string) => string;
  /**
   * Realtime integration (SPEC.md §5 scenario 2, §27) — optional because non-League live
   * match clients may not implement realtime at all. Subscribes `callback` to fire whenever
   * *another* connection's action (a second reporter, or the Durable Object's own
   * `presenceChanged`/`sessionEnded`) is broadcast, so this client can refresh without
   * waiting for the next 5s poll or a manual reload. Returns an unsubscribe function.
   */
  onLiveUpdate?: (callback: () => void) => () => void;
  /** Force an immediate realtime reconnect attempt (SPEC.md §27: "on browser online... 1.
   * obtain a fresh connection ticket 2. reconnect") rather than waiting for the client's own
   * backoff timer, which could otherwise take up to ~30s after connectivity actually returns. */
  reconnectRealtime?: () => void;
  recordEventToServer?: (input: {
    matchId: string;
    sessionId: string;
    eventType: string;
    clientEventId: string;
    period?: string;
    matchSeconds?: number;
    playerId?: string;
    secondaryPlayerId?: string;
    payload?: Record<string, unknown>;
    correctionType?: string;
    correctsEventId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export interface LiveMatchClientProps {
  matchId: string;
  teamName: string;
  opponentName: string;
  contextLabel: string | null;
  periodConfig: PeriodConfig[];
  actions: LiveMatchActions;
  /** True when our team plays at home — the scoreboard follows football home→away order
   * (ADR-0125). Default true. Events have no home/away; pass `markOwnTeam={false}` there. */
  isHome?: boolean;
  /** Whether to subtly accent our team's name in the scoreboard. Default true; false for
   * events (no home/away distinction to orient against). */
  markOwnTeam?: boolean;
}

/** ADR-0133 H6: how many events `fetchEvents` pulls for the score / on-field reconcile. Must
 * comfortably exceed the total event count of a real match (the 2026-09-09 incident had 68) so
 * no goal is ever dropped from the running-score computation. The recent-events *display* list
 * is capped separately (`mergedEvents` slices to 15). */
const LIVE_RECONCILE_EVENT_LIMIT = 1000;

const FAIR_PLAY_POSITIVE_CATEGORIES = [
  "HELPED_OPPONENT",
  "CHECKED_ON_INJURED_PLAYER",
  "ACCEPTED_REFEREE_DECISION",
  "ENCOURAGED_TEAMMATE",
  "CALMED_DIFFICULT_SITUATION",
  "OTHER_POSITIVE",
] as const;

const FAIR_PLAY_CONCERN_CATEGORIES = [
  "RETALIATION",
  "ABUSIVE_LANGUAGE",
  "DISSENT_TOWARD_REFEREE",
  "TAUNTING_OR_PROVOKING",
  "DISRESPECT_TOWARD_TEAMMATE",
  "OTHER_CONCERN",
] as const;

type GoalFlowStep = "idle" | "scorer_select" | "assist_select";
type FairPlayFlowStep = "idle" | "player_select" | "category_select";
type SheetContent = "scorer" | "assist" | "rotation_out" | "rotation_in" | "position_change_player" | "position_change_role" | "fair_play_player" | "fair_play_category" | "period_confirm" | "end_confirm" | null;

function generateClientEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- Isolated Clock Component ---
function LiveClock({ clock, periodConfig }: { clock: MatchClockState; periodConfig: PeriodConfig[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!clock.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [clock.running]);

  const elapsedMs = clock.running ? getElapsedMs(clock, now) : getElapsedMs(clock, Date.now());
  const label = periodConfig.find((p) => p.key === clock.period)?.label ?? clock.period.replace(/_/g, " ");

  return (
    <div className="text-center px-2 min-w-0">
      <div className="text-[var(--text-micro)] uppercase tracking-wider text-[var(--text-muted)] font-medium">{label}</div>
      <div className="text-xl font-mono font-semibold text-[var(--text-soft)] tabular-nums">{formatElapsedMs(elapsedMs)}</div>
    </div>
  );
}

function ScoreboardSide({ name, goals, own }: { name: string; goals: number; own: boolean }) {
  return (
    <div className="flex flex-1 min-w-0 flex-col items-center text-center">
      <div className={`text-xs font-medium truncate ${own ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
        {name}
      </div>
      <div
        data-testid={own ? "live-score-us" : "live-score-them"}
        className="text-4xl font-bold text-[var(--foreground)] tabular-nums leading-tight"
      >
        {goals}
      </div>
    </div>
  );
}

// --- Bottom Sheet ---
function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
    <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden />
    <div
        ref={sheetRef}
        className="relative z-10 bg-[var(--surface-base)] rounded-t-2xl border-t border-[var(--border-strong)] max-h-[75dvh] flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border-soft)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-soft)] text-sm font-medium px-2 py-1 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">Close</button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Player Button ---
function PlayerButton({
  player,
  onField,
  onClick,
  variant,
}: {
  player: SquadPlayer;
  onField: boolean;
  onClick: () => void;
  variant?: "default" | "selected" | "highlight";
}) {
  const bg = variant === "selected"
    ? "bg-[var(--accent)] text-[var(--tl-c-accent-on-fill)]"
    : variant === "highlight"
      ? "bg-[var(--success-subtle)] text-[var(--success)]"
      : onField
        ? "bg-[var(--surface-hover)] text-[var(--text-soft)]"
        : "bg-[var(--surface-hover)]/60 text-[var(--text-muted)]";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-3 rounded-lg text-left active:scale-[0.97] transition-transform ${bg} min-h-[48px]`}
    >
      {player.shirtNumber != null && <span className="text-sm font-bold opacity-70 w-6 text-right shrink-0">{player.shirtNumber}</span>}
      <span className="text-sm font-medium truncate">{player.playerName}</span>
      {onField && <span className="ml-auto text-[var(--text-micro)] text-[var(--success)] uppercase tracking-wide shrink-0">On field</span>}
    </button>
  );
}

// --- Confirmation Dialog ---
function ConfirmDialog({ open, onConfirm, onCancel, title, children }: { open: boolean; onConfirm: () => void; onCancel: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/70" onClick={onCancel} aria-hidden />
      <div className="relative z-10 bg-[var(--surface-base)] rounded-2xl border border-[var(--border-strong)] p-5 mx-4 max-w-sm w-full" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <h3 className="text-base font-semibold text-[var(--foreground)] mb-2">{title}</h3>
        <div className="text-sm text-[var(--text-soft)] mb-4">{children}</div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-lg bg-[var(--surface-hover)] text-[var(--text-soft)] font-medium min-h-[48px]">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 px-4 rounded-lg bg-[var(--danger)] text-white font-medium min-h-[48px]">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// --- Sync Status Indicator ---
type SyncStatus = "synced" | "pending" | "offline" | "error";

function SyncStatusIndicator({ status, pendingCount }: { status: SyncStatus; pendingCount: number }) {
  if (status === "synced" && pendingCount === 0) return null;
  const label = status === "offline"
    ? `Saved locally${pendingCount > 1 ? ` (${pendingCount} waiting)` : ""}`
    : status === "pending"
      ? `${pendingCount} event${pendingCount > 1 ? "s" : ""} syncing...`
      : status === "error"
        ? "Sync issue — data saved locally"
        : null;
  if (!label) return null;
  const color = status === "offline" ? "text-[var(--warning)]" : status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]";
  return <div className={`text-[var(--text-micro)] ${color} text-center py-0.5`}>{label}</div>;
}

// --- Main Component ---
export function LiveMatchClient({ matchId, teamName, opponentName, contextLabel, periodConfig, actions, isHome = true, markOwnTeam = true }: LiveMatchClientProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [onFieldIds, setOnFieldIds] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState<MatchClockState>(createInitialClockState());
  // ADR-0133 H2: persist the clock on every transition (period advance / pause / resume /
  // adjust) so a reload / device swap rehydrates it. NOT on the per-second tick — the tick
  // moves `now`, not `clock`. Best-effort; the server write is forward-only and idempotent.
  const clockHydratedRef = useRef(false);
  useEffect(() => {
    if (!sessionActive || !sessionId || !actions.persistClock) return;
    // Skip the very first render's initial "before kickoff" state — nothing to persist yet,
    // and the pre-match package's own hydration will settle `clock` momentarily.
    if (!clockHydratedRef.current) {
      clockHydratedRef.current = true;
      const isFresh = clock.period === "BEFORE" && !clock.running && clock.elapsedBeforeStartMs === 0;
      if (isFresh) return;
    }
    void actions.persistClock(sessionId, clock);
  }, [clock, sessionActive, sessionId, actions]);
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [recentEvents, setRecentEvents] = useState<LiveEventSummary[]>([]);
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [goalFlow, setGoalFlow] = useState<GoalFlowStep>("idle");
  const [goalFlowPlayerId, setGoalFlowPlayerId] = useState<string | null>(null);
  const [fairPlayFlow, setFairPlayFlow] = useState<FairPlayFlowStep>("idle");
  const [fairPlayPlayerId, setFairPlayPlayerId] = useState<string | null>(null);
  const [isPositive, setIsPositive] = useState(true);
  const [rotationMode, setRotationMode] = useState(false);
  const [outPlayerId, setOutPlayerId] = useState<string | null>(null);
  const [positionChangePlayerId, setPositionChangePlayerId] = useState<string | null>(null);
  // Local-only tracking of an on-field player's current position after a POSITIONS_CHANGED event
  // this session recorded, so the "On field" overview and the picker reflect reality immediately
  // without waiting on a server round-trip. Falls back to the squad's own planned `position`.
  const [positionOverrides, setPositionOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetContent>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ type: "period" | "end"; nextPeriod?: string } | null>(null);
  const [lastAction, setLastAction] = useState<{ label: string; undoEventId?: string; undoLabel?: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const goalFlowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duplicateTapGuardRef = useRef<Set<string>>(new Set());

  // Duplicate-tap guard: 400ms per action type
  const withTapGuard = useCallback((key: string, fn: () => void) => {
    if (duplicateTapGuardRef.current.has(key)) return;
    duplicateTapGuardRef.current.add(key);
    fn();
    setTimeout(() => { duplicateTapGuardRef.current.delete(key); }, 400);
  }, []);

  // Derived
  // A player marked absent for this match (isActiveParticipant === false) is excluded from every
  // action list (scorer, assist, rotation, fair play) — see AGENTS.md "Match-specific player
  // absence state". They remain visible in roster/status contexts outside this live client.
  const activeSquad = useMemo(() => squad.filter((p) => p.isActiveParticipant !== false), [squad]);
  const onFieldPlayers = useMemo(() => activeSquad.filter((p) => onFieldIds.has(p.playerId)), [activeSquad, onFieldIds]);
  const benchPlayers = useMemo(() => activeSquad.filter((p) => !onFieldIds.has(p.playerId)), [activeSquad, onFieldIds]);
  const playerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of squad) {
      map[p.playerId] = p.playerName;
    }
    return map;
  }, [squad]);
  const sortedPlayersForScorer = useMemo(() => [...onFieldPlayers, ...benchPlayers], [onFieldPlayers, benchPlayers]);

  // --- Local-first event recording ---
  const recordEventLocal = useCallback(async (eventType: string, extra?: { playerId?: string; secondaryPlayerId?: string; period?: string; matchSeconds?: number; correctionType?: string; correctsEventId?: string; payload?: Record<string, unknown> }) => {
    if (!sessionId) return;
    const clientEventId = generateClientEventId();
    const localEvent: LocalEvent = {
      id: clientEventId,
      matchId,
      sessionId,
      eventType,
      clientEventId,
      period: extra?.period,
      matchSeconds: extra?.matchSeconds,
      playerId: extra?.playerId,
      secondaryPlayerId: extra?.secondaryPlayerId,
      payload: extra?.payload,
      correctionType: extra?.correctionType,
      correctsEventId: extra?.correctsEventId,
      synced: false,
      createdAt: Date.now(),
    };

    setLocalEvents((prev) => [...prev, localEvent]);
    setUnsyncedCount((prev) => prev + 1);
    setSyncStatus("pending");

    try {
      await saveEventLocally(localEvent);

      const result = await actions.recordEvent({
        matchId,
        sessionId,
        eventType,
        clientEventId,
        ...extra,
      });

      if (result.success) {
        await markEventSynced(clientEventId);
        setLocalEvents((prev) => prev.map((e) => e.clientEventId === clientEventId ? { ...e, synced: true } : e));
        setUnsyncedCount((prev) => Math.max(0, prev - 1));
        setSyncStatus((prev) => prev === "pending" ? "synced" : prev);
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
    }
  }, [matchId, sessionId, actions]);

  // --- Sync unsynced events on reconnect ---
  const syncUnsyncedEvents = useCallback(async () => {
    if (!sessionId) return;
    try {
      const unsynced = await getUnsyncedEvents(matchId);
      let synced = 0;
      for (const event of unsynced) {
        const result = await actions.recordEvent({
          matchId: event.matchId,
          sessionId: event.sessionId,
          eventType: event.eventType,
          clientEventId: event.clientEventId,
          period: event.period,
          matchSeconds: event.matchSeconds,
          playerId: event.playerId,
          secondaryPlayerId: event.secondaryPlayerId,
          payload: event.payload,
          correctionType: event.correctionType,
          correctsEventId: event.correctsEventId,
        });
        if (result.success) {
          await markEventSynced(event.clientEventId);
          synced++;
        } else {
          break;
        }
      }
      setLocalEvents((prev) => prev.map((e) => e.synced ? e : { ...e, synced: true }));
      setUnsyncedCount((prev) => Math.max(0, prev - synced));
      if (unsynced.length === synced) {
        setSyncStatus("synced");
      }
    } catch {
      // Will retry on next online event
    }
  }, [matchId, sessionId, actions]);

  // --- Effects ---
  useEffect(() => {
    async function loadPreMatch() {
      setLoading(true);
      const result = await actions.getPreMatchPackage(matchId);
      if (result.success && result.data) {
        setSquad(result.data.squad);
        setOnFieldIds(new Set(result.data.squad.filter((p) => p.startingOnField).map((p) => p.playerId)));
        if (result.data.activeSession) {
          setSessionId(result.data.activeSession.id);
          setSessionActive(true);
          const savedSession = { id: result.data.activeSession.id, matchId, coachId: result.data.activeSession.coachId, startedAt: result.data.activeSession.startedAt };
          await saveSessionLocally(savedSession);
          // ADR-0133 H2: rehydrate the clock from the persisted session state so a reload /
          // device swap does not reset it to "before kickoff". A still-`BEFORE`, not-running,
          // zero-elapsed clock is indistinguishable from the fresh initial state, so leave the
          // initial `useState` value in place for that case.
          const savedClock = result.data.activeSession.clock;
          if (
            savedClock &&
            !(savedClock.period === "BEFORE" && !savedClock.running && savedClock.elapsedBeforeStartMs === 0)
          ) {
            setClock({
              period: savedClock.period as MatchClockState["period"],
              running: savedClock.running,
              startedAt: savedClock.startedAt ? new Date(savedClock.startedAt) : null,
              elapsedBeforeStartMs: savedClock.elapsedBeforeStartMs,
            });
          }
        }
      } else {
        setError(result.error ?? "Failed to load match data");
      }
      setLoading(false);
    }
    loadPreMatch();
  }, [matchId, actions]);

  useEffect(() => {
    if (!sessionActive) return;
    const interval = setInterval(async () => {
      if (sessionId) {
        try { await actions.heartbeat(sessionId); } catch { /* heartbeat is non-critical */ }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [sessionActive, sessionId, actions]);

  const fetchEvents = useCallback(async () => {
    // ADR-0133 H6: reconcile the score / on-field state from the WHOLE match's event set, not a
    // 20-event tail. The old 20-event window silently dropped every goal older than the last 20
    // events, so `reconcileFromServerEvents` under-counted and `setGoalsFor/Against` reset the
    // true running score to that under-count on every 5s poll and every reconnect broadcast —
    // the coach saw goals "disappear". The recent-events display list is still capped downstream
    // (`mergedEvents` slices to 15).
    const result = await actions.getRecentEvents(matchId, LIVE_RECONCILE_EVENT_LIMIT);
    if (result.success && result.data) {
      setRecentEvents(result.data);
      if (squad.length > 0) {
        const initialOnField = new Set(squad.filter((p) => p.startingOnField).map((p) => p.playerId));
        const reconciled = reconcileFromServerEvents(result.data, initialOnField);
        setGoalsFor(reconciled.goalsFor);
        setGoalsAgainst(reconciled.goalsAgainst);
        setOnFieldIds(reconciled.onFieldPlayerIds);
      }
    }
  }, [actions, matchId, squad]);

  useEffect(() => {
    if (!sessionActive) return;
    fetchEvents();
    const interval = setInterval(fetchEvents, 5_000);
    return () => clearInterval(interval);
  }, [sessionActive, fetchEvents]);

  // SPEC.md §5 scenario 2 / §27 — a second reporter's action (or a presence/session-ended
  // broadcast) refreshes this client immediately, instead of waiting for the next 5s poll.
  useEffect(() => {
    if (!sessionActive || !actions.onLiveUpdate) return;
    return actions.onLiveUpdate(fetchEvents);
  }, [sessionActive, actions, fetchEvents]);

  // Sync on reconnect
  useEffect(() => {
    const handleOnline = () => {
      syncUnsyncedEvents();
      actions.reconnectRealtime?.();
    };
    window.addEventListener("online", handleOnline);
    const handleVisibility = () => {
      if (!document.hidden) {
        syncUnsyncedEvents();
        actions.reconnectRealtime?.();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncUnsyncedEvents, actions]);

  // Restore local events on mount
  useEffect(() => {
    if (!sessionActive) return;
    getAllLocalEvents(matchId).then((events) => {
      setLocalEvents(events);
      const unsynced = events.filter((e) => !e.synced);
      if (unsynced.length > 0) {
        setUnsyncedCount(unsynced.length);
        setSyncStatus("pending");
        syncUnsyncedEvents();
      }
    });
  }, [sessionActive, matchId]);

  // --- Handlers ---
  const handleStartSession = useCallback(async () => {
    const result = await actions.startSession(matchId);
    if (result.success && result.data) {
      setSessionId(result.data.id);
      setSessionActive(true);
      setError(null);
      await saveSessionLocally({ id: result.data.id, matchId, coachId: "", startedAt: new Date().toISOString() });
    } else {
      setError(result.error ?? "Failed to start session");
    }
  }, [matchId, actions]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setConfirmDialog(null);
    // Try syncing before ending, then verify against the local store directly — syncUnsyncedEvents
    // can fail partway through and swallow the error, so stale unsyncedCount state can't be trusted.
    await syncUnsyncedEvents();
    const stillUnsynced = await getUnsyncedEvents(matchId);
    if (stillUnsynced.length > 0) {
      setUnsyncedCount(stillUnsynced.length);
      setSyncStatus("error");
      setError(
        `${stillUnsynced.length} event${stillUnsynced.length > 1 ? "s" : ""} could not sync and would be lost. Check your connection and try finishing again.`,
      );
      return;
    }
    const result = await actions.endSession(sessionId);
    if (result.success) {
      setSessionActive(false);
      setSessionId(null);
      await clearLocalEvents(matchId);
      await clearLocalSession(matchId);
      if (result.data?.reportId && actions.reportUrl) {
        window.location.href = actions.reportUrl(result.data.reportId);
      }
    } else {
      setError(result.error ?? "Failed to end session");
    }
  }, [sessionId, actions, matchId, syncUnsyncedEvents]);

  const handlePeriodAdvance = useCallback(() => {
    const nextPeriod = getPeriodAfter(clock.period, periodConfig);
    if (!nextPeriod) return;

    // Period-ending actions require confirmation
    const isEndingPlaying = isPlayingPeriod(clock.period, periodConfig);
    if (isEndingPlaying || clock.period === "FULL_TIME") {
      const periodLabel = periodConfig.find((p) => p.key === clock.period)?.label ?? clock.period.replace(/_/g, " ");
      const nextLabel = periodConfig.find((p) => p.key === nextPeriod)?.label ?? nextPeriod.replace(/_/g, " ");
      setConfirmDialog({
        type: "period",
        nextPeriod: `End ${periodLabel} and start ${nextLabel}?`,
      });
      return;
    }

    const next = advancePeriod(clock, periodConfig);
    setClock(next);
    const periodEvents: Record<string, string> = {};
    for (const p of periodConfig) {
      if (p.key === "BEFORE") periodEvents[p.key] = "MATCH_START";
      else if (p.type === "playing") periodEvents[p.key] = "PERIOD_START";
      else if (p.key === "FULL_TIME") periodEvents[p.key] = "MATCH_END";
      else periodEvents[p.key] = "PERIOD_END";
    }
    periodEvents["FULL_TIME"] = "MATCH_END";
    const currentPeriodEvent = periodEvents[next.period];
    if (currentPeriodEvent && sessionId) {
      recordEventLocal(currentPeriodEvent, { period: next.period });
    }
  }, [clock, sessionId, periodConfig, recordEventLocal]);

  const confirmPeriodAdvance = useCallback(() => {
    setConfirmDialog(null);
    const next = advancePeriod(clock, periodConfig);
    setClock(next);
    const periodEvents: Record<string, string> = {};
    for (const p of periodConfig) {
      if (p.key === "BEFORE") periodEvents[p.key] = "MATCH_START";
      else if (p.type === "playing") periodEvents[p.key] = "PERIOD_START";
      else if (p.key === "FULL_TIME") periodEvents[p.key] = "MATCH_END";
      else periodEvents[p.key] = "PERIOD_END";
    }
    periodEvents["FULL_TIME"] = "MATCH_END";
    const currentPeriodEvent = periodEvents[next.period];
    if (currentPeriodEvent && sessionId) {
      recordEventLocal(currentPeriodEvent, { period: next.period });
    }
  }, [clock, sessionId, periodConfig, recordEventLocal]);

  const handleGoalFor = useCallback(() => {
    withTapGuard("goal_for", () => {
      setGoalsFor((prev) => prev + 1);
      recordEventLocal("GOAL_FOR", { period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
      setLastAction({ label: "Goal for us recorded", undoLabel: "Undo goal for us" });
      if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
      lastActionTimerRef.current = setTimeout(() => setLastAction(null), 15000);
      setGoalFlow("scorer_select");
      setSheet("scorer");
      if (goalFlowTimerRef.current) clearTimeout(goalFlowTimerRef.current);
      goalFlowTimerRef.current = setTimeout(() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); }, GOAL_DETAIL_INACTIVITY_TIMEOUT_MS);
    });
  }, [clock, recordEventLocal, withTapGuard]);

  const handleGoalAgainst = useCallback(() => {
    withTapGuard("goal_against", () => {
      setGoalsAgainst((prev) => prev + 1);
      recordEventLocal("GOAL_AGAINST", { period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
      setLastAction({ label: "Goal for them recorded", undoLabel: "Undo goal for them" });
      if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
      lastActionTimerRef.current = setTimeout(() => setLastAction(null), 15000);
    });
  }, [clock, recordEventLocal, withTapGuard]);

  const handleScorerSelect = useCallback((playerId: string) => {
    setGoalFlowPlayerId(playerId);
    recordEventLocal("SCORER_SET", { playerId, period: clock.period });
    setGoalFlow("assist_select");
    setSheet("assist");
    if (goalFlowTimerRef.current) clearTimeout(goalFlowTimerRef.current);
    goalFlowTimerRef.current = setTimeout(() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); }, GOAL_DETAIL_INACTIVITY_TIMEOUT_MS);
  }, [clock, recordEventLocal]);

  const handleAssistSelect = useCallback((playerId: string | null) => {
    if (playerId) {
      recordEventLocal("ASSIST_SET", { playerId, secondaryPlayerId: goalFlowPlayerId ?? undefined, period: clock.period });
    }
    setGoalFlow("idle");
    setGoalFlowPlayerId(null);
    setSheet(null);
    if (goalFlowTimerRef.current) clearTimeout(goalFlowTimerRef.current);
  }, [clock, recordEventLocal, goalFlowPlayerId]);

  const handleMomentMarked = useCallback(() => {
    withTapGuard("moment", () => {
      recordEventLocal("MOMENT_MARKED", { period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
      setLastAction({ label: "Moment marked" });
      if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
      lastActionTimerRef.current = setTimeout(() => setLastAction(null), 8000);
    });
  }, [clock, recordEventLocal, withTapGuard]);

  const handleFairPlayStart = useCallback((positive: boolean) => {
    setIsPositive(positive);
    setFairPlayFlow("player_select");
    setSheet("fair_play_player");
  }, []);

  const handleFairPlayPlayer = useCallback((playerId: string | null) => {
    setFairPlayPlayerId(playerId);
    setFairPlayFlow("category_select");
    setSheet("fair_play_category");
  }, []);

  const handleFairPlayCategory = useCallback((category: string) => {
    recordEventLocal(isPositive ? "FAIR_PLAY_POSITIVE" : "FAIR_PLAY_CONCERN", {
      playerId: fairPlayPlayerId ?? undefined,
      period: clock.period,
      payload: { category },
    });
    setFairPlayFlow("idle");
    setFairPlayPlayerId(null);
    setSheet(null);
    setLastAction({ label: isPositive ? "Positive fair play recorded" : "Fair play concern recorded" });
    if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
    lastActionTimerRef.current = setTimeout(() => setLastAction(null), 8000);
  }, [isPositive, fairPlayPlayerId, clock, recordEventLocal]);

  const handleUndo = useCallback(async (eventId: string) => {
    recordEventLocal("EVENT_REVERSED", { correctsEventId: eventId, correctionType: "REVERSAL" });
    // Optimistically update local score
    const eventToUndo = recentEvents.find((e) => e.id === eventId) ?? localEvents.find((e) => e.clientEventId === eventId);
    if (eventToUndo) {
      const et = eventToUndo.eventType;
      if (et === "GOAL_FOR") setGoalsFor((prev) => Math.max(0, prev - 1));
      if (et === "GOAL_AGAINST") setGoalsAgainst((prev) => Math.max(0, prev - 1));
    }
    setLastAction({ label: "Event reversed" });
    if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
    lastActionTimerRef.current = setTimeout(() => setLastAction(null), 8000);
  }, [recentEvents, localEvents, recordEventLocal]);

  const handleRotationOut = useCallback((playerId: string) => {
    setOutPlayerId(playerId);
    setSheet("rotation_in");
  }, []);

  const handleRotationIn = useCallback((inPlayerId: string) => {
    if (!outPlayerId) return;
    // Optimistic lineup update
    setOnFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(outPlayerId);
      next.add(inPlayerId);
      return next;
    });
    recordEventLocal("ROTATION_OUT", { playerId: outPlayerId, period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
    recordEventLocal("ROTATION_IN", { playerId: inPlayerId, period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
    const outName = squad.find((p) => p.playerId === outPlayerId)?.playerName ?? "Player";
    const inName = squad.find((p) => p.playerId === inPlayerId)?.playerName ?? "Player";
    setLastAction({ label: `${outName} out, ${inName} in` });
    if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
    lastActionTimerRef.current = setTimeout(() => setLastAction(null), 15000);
    setOutPlayerId(null);
    setRotationMode(false);
    setSheet(null);
  }, [outPlayerId, clock, recordEventLocal, squad]);

  const handleStartRotation = useCallback(() => {
    setRotationMode(true);
    setOutPlayerId(null);
    setSheet("rotation_out");
  }, []);

  // --- Position change (no substitution — an on-field player takes a different position,
  // e.g. a formation reshuffle). Records a POSITIONS_CHANGED event, the same canonical event
  // type already produced when a planned position-only rotation change is applied
  // (planned-rotation-live-actions.ts) — this is the manual live-reporting equivalent of that.
  const getCurrentPosition = useCallback((playerId: string): string | null => {
    return positionOverrides[playerId] ?? squad.find((p) => p.playerId === playerId)?.position ?? null;
  }, [positionOverrides, squad]);

  const handleStartPositionChange = useCallback(() => {
    setPositionChangePlayerId(null);
    setSheet("position_change_player");
  }, []);

  const handlePositionChangeSelectPlayer = useCallback((playerId: string) => {
    setPositionChangePlayerId(playerId);
    setSheet("position_change_role");
  }, []);

  const handlePositionChangeSelectRole = useCallback((newPosition: string) => {
    if (!positionChangePlayerId) return;
    const moverId = positionChangePlayerId;
    const fromPosition = getCurrentPosition(moverId);
    if (fromPosition === newPosition) {
      setPositionChangePlayerId(null);
      setSheet(null);
      return;
    }

    // If another on-field player already holds the target position, this is a genuine swap, not
    // a one-sided move — recording only the mover's event would leave two players labelled at
    // `newPosition` and nobody at `fromPosition`. Record both sides atomically, mirroring
    // planned-rotation-live-actions.ts's existing positionOnly swap handling.
    const occupant = fromPosition
      ? onFieldPlayers.find((p) => p.playerId !== moverId && getCurrentPosition(p.playerId) === newPosition)
      : undefined;

    recordEventLocal("POSITIONS_CHANGED", {
      playerId: moverId,
      period: clock.period,
      matchSeconds: getElapsedMs(clock, Date.now()),
      payload: { fromPosition, toPosition: newPosition },
    });
    if (occupant) {
      recordEventLocal("POSITIONS_CHANGED", {
        playerId: occupant.playerId,
        period: clock.period,
        matchSeconds: getElapsedMs(clock, Date.now()),
        payload: { fromPosition: newPosition, toPosition: fromPosition },
      });
    }

    setPositionOverrides((prev) => {
      const next = { ...prev, [moverId]: newPosition };
      if (occupant && fromPosition) next[occupant.playerId] = fromPosition;
      return next;
    });

    const moverName = squad.find((p) => p.playerId === moverId)?.playerName ?? "Player";
    setLastAction({
      label: occupant
        ? `${moverName} and ${occupant.playerName} swapped positions (${fromPosition} ↔ ${newPosition})`
        : `${moverName} moved to ${newPosition}`,
    });
    if (lastActionTimerRef.current !== null) clearTimeout(lastActionTimerRef.current);
    lastActionTimerRef.current = setTimeout(() => setLastAction(null), 8000);
    setPositionChangePlayerId(null);
    setSheet(null);
  }, [positionChangePlayerId, getCurrentPosition, clock, recordEventLocal, squad, onFieldPlayers]);

  // Merged events: server events + local-only events (not yet synced or synced but not yet in server poll)
  const mergedEvents = useMemo(() => {
    const localOnly = localEvents.filter((e) => {
      if (e.synced) return false;
      if (e.eventType === "EVENT_REVERSED") return false; // reversals are handled by removing the original
      return true;
    });
    const localSummaries: LiveEventSummary[] = localOnly.map((e) => ({
      id: e.clientEventId,
      eventType: e.eventType as LiveEventSummary["eventType"],
      period: (e.period as LiveEventSummary["period"]) ?? null,
      matchSeconds: e.matchSeconds ?? null,
      wallClockTime: null,
      playerId: e.playerId ?? null,
      secondaryPlayerId: e.secondaryPlayerId ?? null,
      isCorrected: false,
      isReversed: false,
      correctsEventId: e.correctsEventId ?? null,
    }));
    const all = [...recentEvents, ...localSummaries];
    const seen = new Set<string>();
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    }).sort((a, b) => {
      const aTime = a.wallClockTime ? new Date(a.wallClockTime).getTime() : 0;
      const bTime = b.wallClockTime ? new Date(b.wallClockTime).getTime() : 0;
      return bTime - aTime;
    }).slice(0, 15);
  }, [recentEvents, localEvents]);

  const isOver = isMatchOver(clock.period);
  const currentPeriodLabel = periodConfig.find((p) => p.key === clock.period)?.label ?? clock.period.replace(/_/g, " ");

  // --- Period action label ---
  const periodActionLabel = useMemo(() => {
    if (isOver) return "Match ended";
    const nextPeriod = getPeriodAfter(clock.period, periodConfig);
    if (!nextPeriod) return "Match ended";
    const nextLabel = periodConfig.find((p) => p.key === nextPeriod)?.label ?? nextPeriod.replace(/_/g, " ");
    if (clock.period === "BEFORE") return `Start ${nextLabel.toLowerCase()}`;
    if (isPlayingPeriod(clock.period, periodConfig)) return `End ${currentPeriodLabel.toLowerCase()}`;
    if (isBreakPeriod(clock.period, periodConfig)) return `Start ${nextLabel.toLowerCase()}`;
    return `Next: ${nextLabel}`;
  }, [clock.period, periodConfig, currentPeriodLabel, isOver]);

  // --- Render ---
  if (loading) {
    return (
      // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 7).
      <div className="touchline flex items-center justify-center min-h-[100dvh] bg-[var(--background)]">
        <p className="text-[var(--text-muted)]">Loading match data...</p>
      </div>
    );
  }

  if (!sessionActive) {
    return (
      // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 7).
      <div className="touchline flex flex-col items-center justify-center min-h-[100dvh] bg-[var(--background)] p-6 space-y-6" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{teamName}</h1>
          <p className="text-[var(--text-muted)] mt-1 text-lg">vs {opponentName}</p>
          {contextLabel && <p className="text-sm text-[var(--text-muted)] mt-1">{contextLabel}</p>}
        </div>
        <button
          onClick={handleStartSession}
          className="w-full max-w-xs px-8 py-5 bg-[var(--tl-c-accent)] text-[var(--tl-c-accent-on-fill)] hover:brightness-105 active:brightness-95 text-lg font-semibold rounded-xl transition-[filter] min-h-[56px]"
        >
          Start live reporting
        </button>
        {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
      </div>
    );
  }

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 7).
    <div className="touchline min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Scoreboard — canonical football home→away order (ADR-0125). Deliberately a
          compact operational-focus density (one row, sticky) rather than the full
          MatchHeader: the live action buttons must stay above the fold. Our team is
          marked only by a subtle name accent, never by a score colour. */}
      <div className="sticky top-0 z-30 bg-[var(--surface-base)] border-b border-[var(--border-soft)]">
        <div className="flex items-center px-3 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}>
          <ScoreboardSide
            name={isHome ? teamName : opponentName}
            goals={isHome ? goalsFor : goalsAgainst}
            own={isHome && markOwnTeam}
          />
          <div className="shrink-0">
            <LiveClock clock={clock} periodConfig={periodConfig} />
          </div>
          <ScoreboardSide
            name={isHome ? opponentName : teamName}
            goals={isHome ? goalsAgainst : goalsFor}
            own={!isHome && markOwnTeam}
          />
        </div>
        <SyncStatusIndicator status={syncStatus} pendingCount={unsyncedCount} />
      </div>

      {/* Period control */}
      <div className="px-3 py-2 border-b border-[var(--border-soft)]">
        <button
          onClick={() => handlePeriodAdvance()}
          disabled={isOver}
          className={`w-full py-3 px-4 rounded-lg text-sm font-semibold min-h-[48px] transition-colors ${
            isOver
              ? "bg-[var(--surface-hover)] text-[var(--text-muted)] cursor-not-allowed"
              : isPlayingPeriod(clock.period, periodConfig)
                ? "bg-[var(--warning-subtle)] text-[var(--warning)] hover:brightness-110 active:brightness-95"
                : "bg-[var(--surface-hover)] text-[var(--text-soft)] hover:bg-[var(--surface-strong)] active:bg-[var(--surface-hover)]"
          }`}
        >
          {periodActionLabel}
        </button>
      </div>

      {/* Last action feedback */}
      {lastAction && (
        <div className="mx-3 mt-2 px-3 py-2 bg-[var(--success-subtle)] border border-[color-mix(in_srgb,var(--success)_35%,transparent)] rounded-lg flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--success)]">{lastAction.label}</span>
          {lastAction.undoLabel && lastAction.undoEventId !== undefined && (
            <button
              onClick={() => handleUndo(lastAction.undoEventId!)}
              className="text-xs text-[var(--warning)] hover:opacity-80 font-semibold whitespace-nowrap min-h-[36px] px-2"
            >
              {lastAction.undoLabel}
            </button>
          )}
        </div>
      )}

      {/* Primary goal controls */}
      <div className="px-3 pt-3 flex gap-2">
        <button
          onClick={handleGoalFor}
          className="flex-1 py-4 bg-[var(--tl-c-accent)] text-[var(--tl-c-accent-on-fill)] hover:brightness-105 active:brightness-95 rounded-xl font-bold text-base min-h-[64px] transition-[filter]"
        >
          Goal for us
        </button>
        <button
          onClick={handleGoalAgainst}
          className="flex-1 py-4 bg-[var(--surface-strong)] hover:bg-[var(--surface-strong)] active:bg-[var(--surface-hover)] text-[var(--text-soft)] rounded-xl font-bold text-base min-h-[64px] transition-colors"
        >
          Goal for them
        </button>
      </div>

      {/* Secondary controls */}
      <div className="px-3 pt-2 flex gap-2">
        <button
          onClick={handleStartRotation}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold min-h-[48px] transition-colors ${
            rotationMode ? "bg-[var(--accent-subtle)] text-[var(--accent-strong)]" : "bg-[var(--surface-hover)] text-[var(--text-soft)] hover:bg-[var(--surface-strong)]"
          }`}
        >
          Rotation
        </button>
        <button
          onClick={handleStartPositionChange}
          className="flex-1 py-2.5 bg-[var(--surface-hover)] text-[var(--text-soft)] hover:bg-[var(--surface-strong)] rounded-lg text-sm font-semibold min-h-[48px] transition-colors"
        >
          Position
        </button>
      </div>
      <div className="px-3 pt-2 flex gap-2">
        <button
          onClick={() => handleFairPlayStart(true)}
          className="flex-1 py-2.5 bg-[var(--success-subtle)] text-[var(--success)] hover:brightness-110 active:brightness-95 rounded-lg text-sm font-semibold min-h-[48px] transition-[filter]"
        >
          Fair play +
        </button>
        <button
          onClick={handleMomentMarked}
          className="flex-1 py-2.5 bg-[var(--surface-hover)] text-[var(--text-soft)] hover:bg-[var(--surface-strong)] rounded-lg text-sm font-semibold min-h-[48px] transition-colors"
        >
          Mark moment
        </button>
      </div>

      {/* Fair play concern */}
      <div className="px-3 pt-1">
        <button
          onClick={() => handleFairPlayStart(false)}
          className="w-full py-2 text-sm text-[var(--danger)] bg-[var(--danger-subtle)] hover:brightness-110 rounded-lg min-h-[44px] transition-[filter]"
        >
          Fair play concern
        </button>
      </div>

      {/* On-field overview */}
      {onFieldPlayers.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[var(--text-micro)] font-semibold text-[var(--success)] uppercase tracking-wider">On field ({onFieldPlayers.length})</h3>
            <span className="text-[var(--text-micro)] text-[var(--text-muted)]">{benchPlayers.length} bench</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {onFieldPlayers.map((p) => {
              const currentPosition = getCurrentPosition(p.playerId);
              return (
                <span key={p.playerId} className="inline-flex items-center px-1.5 py-0.5 text-[var(--text-micro)] bg-[var(--success-subtle)] text-[var(--success)] rounded">
                  {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                  {p.playerName}
                  {currentPosition && <span className="ml-0.5 opacity-70">({currentPosition})</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent events with undo */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        <h3 className="text-[var(--text-micro)] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Recent events</h3>
        {mergedEvents.length === 0 ? (
          <p className="text-xs text-[var(--text-disabled)]">No events recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {mergedEvents.map((event) => {
              const label = getEventTypeLabel(event.eventType);
              const playerName = event.playerId ? playerMap[event.playerId] : undefined;
              const secondaryName = event.secondaryPlayerId ? playerMap[event.secondaryPlayerId] : undefined;
              let displayText = label;
              if (playerName && secondaryName) {
                displayText = `${label} — ${playerName} / ${secondaryName}`;
              } else if (playerName) {
                displayText = `${label} — ${playerName}`;
              }
              return (
                <div key={event.id} className="flex items-center justify-between py-1.5 px-2 bg-[var(--surface-base)]/80 rounded text-xs">
                  <div className="min-w-0 flex items-baseline gap-1.5">
                    {/* event.matchSeconds is milliseconds since period start (legacy name — ADR-0133 H3);
                        formatElapsedMs takes ms, so no ×1000. */}
                    {event.matchSeconds != null && (
                      <span className="text-[var(--text-micro)] font-mono text-[var(--text-muted)] shrink-0">{formatElapsedMs(event.matchSeconds)}</span>
                    )}
                    <span className="text-[var(--text-soft)]">{displayText}</span>
                    {event.isReversed && <span className="text-[var(--danger)] ml-1 text-[var(--text-micro)]">reversed</span>}
                    {event.isCorrected && <span className="text-[var(--warning)] ml-1 text-[var(--text-micro)]">corrected</span>}
                  </div>
                  {!event.isReversed && LIVE_EVENT_TYPES_THAT_ARE_CORRECTABLE.has(event.eventType) && (
                    <button
                      onClick={() => handleUndo(event.id)}
                      className="text-[var(--text-micro)] text-[var(--text-muted)] hover:text-[var(--text-soft)] shrink-0 ml-2 min-h-[36px] px-1"
                    >
                      Undo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Finish button */}
      <div className="px-3 py-3 border-t border-[var(--border-soft)]" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={() => setConfirmDialog({ type: "end" })}
          className="w-full py-3 text-sm text-[var(--text-muted)] hover:text-[var(--text-soft)] bg-[var(--surface-hover)]/50 hover:bg-[var(--surface-hover)] rounded-lg min-h-[48px] transition-colors"
        >
          Finish live reporting
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-[var(--danger-subtle)] border-t border-[color-mix(in_srgb,var(--danger)_35%,transparent)]" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <p className="text-[var(--danger)] text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-[var(--danger)] hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* Bottom sheets */}

      {/* Scorer selection */}
      <BottomSheet open={goalFlow === "scorer_select" && sheet === "scorer"} onClose={() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); }} title="Who scored?">
        <div className="space-y-1.5">
          <button onClick={() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); if (goalFlowTimerRef.current) clearTimeout(goalFlowTimerRef.current); }} className="w-full py-2.5 px-4 bg-[var(--surface-hover)] text-[var(--text-soft)] rounded-lg text-sm font-medium min-h-[48px]">
            Skip
          </button>
          {sortedPlayersForScorer.map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={onFieldIds.has(p.playerId)} onClick={() => handleScorerSelect(p.playerId)} variant={onFieldIds.has(p.playerId) ? "highlight" : "default"} />
          ))}
        </div>
      </BottomSheet>

      {/* Assist selection */}
      <BottomSheet open={goalFlow === "assist_select" && sheet === "assist"} onClose={() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); if (goalFlowTimerRef.current) clearTimeout(goalFlowTimerRef.current); }} title="Assist?">
        <div className="space-y-1.5">
          <button onClick={() => handleAssistSelect(null)} className="w-full py-2.5 px-4 bg-[var(--surface-hover)] text-[var(--text-soft)] rounded-lg text-sm font-medium min-h-[48px]">
            No assist
          </button>
          {sortedPlayersForScorer.filter((p) => p.playerId !== goalFlowPlayerId).map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={onFieldIds.has(p.playerId)} onClick={() => handleAssistSelect(p.playerId)} variant={onFieldIds.has(p.playerId) ? "highlight" : "default"} />
          ))}
        </div>
      </BottomSheet>

      {/* Rotation out */}
      <BottomSheet open={rotationMode && !outPlayerId && sheet === "rotation_out"} onClose={() => { setRotationMode(false); setOutPlayerId(null); setSheet(null); }} title="Player going off">
        <div className="space-y-1.5">
          {onFieldPlayers.length > 0 ? onFieldPlayers.map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={true} onClick={() => handleRotationOut(p.playerId)} variant="highlight" />
          )) : activeSquad.map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={false} onClick={() => handleRotationOut(p.playerId)} />
          ))}
        </div>
      </BottomSheet>

      {/* Rotation in */}
      <BottomSheet open={rotationMode && outPlayerId !== null && sheet === "rotation_in"} onClose={() => { setOutPlayerId(null); setSheet("rotation_out"); }} title={`Replacing: ${squad.find((p) => p.playerId === outPlayerId)?.playerName ?? "Player"}`}>
        <div className="space-y-1.5">
          {benchPlayers.map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={false} onClick={() => handleRotationIn(p.playerId)} />
          ))}
        </div>
      </BottomSheet>

      {/* Position change: player select */}
      <BottomSheet open={sheet === "position_change_player"} onClose={() => { setPositionChangePlayerId(null); setSheet(null); }} title="Who changed position?">
        <div className="space-y-1.5">
          {onFieldPlayers.length > 0 ? onFieldPlayers.map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={true} onClick={() => handlePositionChangeSelectPlayer(p.playerId)} variant="highlight" />
          )) : (
            <p className="text-sm text-[var(--text-muted)] px-3 py-2">No players on field yet.</p>
          )}
        </div>
      </BottomSheet>

      {/* Position change: new position select */}
      <BottomSheet
        open={sheet === "position_change_role"}
        onClose={() => { setPositionChangePlayerId(null); setSheet(null); }}
        title={`New position for ${squad.find((p) => p.playerId === positionChangePlayerId)?.playerName ?? "player"}`}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {EXACT_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => handlePositionChangeSelectRole(role)}
              className="py-3 rounded-lg text-sm font-semibold bg-[var(--surface-hover)] text-[var(--text-soft)] hover:bg-[var(--surface-strong)] min-h-[44px]"
            >
              {role}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Fair play player selection */}
      <BottomSheet open={fairPlayFlow === "player_select" && sheet === "fair_play_player"} onClose={() => { setFairPlayFlow("idle"); setFairPlayPlayerId(null); setSheet(null); }} title={isPositive ? "Which player? (positive)" : "Which player? (concern)"}>
        <div className="space-y-1.5">
          <button onClick={() => handleFairPlayPlayer(null)} className="w-full py-2.5 px-4 bg-[var(--surface-hover)] text-[var(--text-soft)] rounded-lg text-sm font-medium min-h-[48px]">
            No specific player
          </button>
          {sortedPlayersForScorer.map((p) => (
            <PlayerButton key={p.playerId} player={p} onField={onFieldIds.has(p.playerId)} onClick={() => handleFairPlayPlayer(p.playerId)} variant={onFieldIds.has(p.playerId) ? "highlight" : "default"} />
          ))}
        </div>
      </BottomSheet>

      {/* Fair play category selection */}
      <BottomSheet open={fairPlayFlow === "category_select" && sheet === "fair_play_category"} onClose={() => { setFairPlayFlow("idle"); setFairPlayPlayerId(null); setSheet(null); }} title={isPositive ? "Positive fair play" : "Fair play concern"}>
        <div className="space-y-1.5">
          {(isPositive ? FAIR_PLAY_POSITIVE_CATEGORIES : FAIR_PLAY_CONCERN_CATEGORIES).map((cat) => (
            <button
              key={cat}
              onClick={() => handleFairPlayCategory(cat)}
              className={`w-full py-3 px-4 rounded-lg text-sm font-medium min-h-[48px] text-left transition-[filter] ${
                isPositive ? "bg-[var(--success-subtle)] text-[var(--success)] hover:brightness-110" : "bg-[var(--danger-subtle)] text-[var(--danger)] hover:brightness-110"
              }`}
            >
              {getFairPlayCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={confirmDialog?.type === "period"}
        onConfirm={confirmPeriodAdvance}
        onCancel={() => setConfirmDialog(null)}
        title="End period?"
      >
        {confirmDialog?.nextPeriod ?? "Are you sure?"}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDialog?.type === "end"}
        onConfirm={handleEndSession}
        onCancel={() => setConfirmDialog(null)}
        title="Finish live reporting?"
      >
        <div className="space-y-1">
          <p>Score: <span className="font-bold">{teamName} {goalsFor} – {goalsAgainst} {opponentName}</span></p>
          <p>Period: {currentPeriodLabel}</p>
          {unsyncedCount > 0 && <p className="text-[var(--warning)]">{unsyncedCount} event{unsyncedCount > 1 ? "s" : ""} waiting to sync</p>}
        </div>
      </ConfirmDialog>
    </div>
  );
}

const LIVE_EVENT_TYPES_THAT_ARE_CORRECTABLE = new Set([
  "GOAL_FOR",
  "GOAL_AGAINST",
  "SCORER_SET",
  "ASSIST_SET",
  "ROTATION_OUT",
  "ROTATION_IN",
  "FAIR_PLAY_POSITIVE",
  "FAIR_PLAY_CONCERN",
  "MOMENT_MARKED",
]);