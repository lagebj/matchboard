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
      activeSession: { id: string; coachId: string; startedAt: string } | null;
    };
    error?: string;
  }>;
  reportUrl?: (reportId: string) => string;
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
}

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
type SheetContent = "scorer" | "assist" | "rotation_out" | "rotation_in" | "fair_play_player" | "fair_play_category" | "period_confirm" | "end_confirm" | null;

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
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{label}</div>
      <div className="text-xl font-mono font-semibold text-zinc-200 tabular-nums">{formatElapsedMs(elapsedMs)}</div>
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
        className="relative z-10 bg-zinc-900 rounded-t-2xl border-t border-zinc-700 max-h-[75dvh] flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-zinc-800 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-sm font-medium px-2 py-1 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">Close</button>
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
    ? "bg-blue-800 text-blue-100"
    : variant === "highlight"
      ? "bg-emerald-800/60 text-emerald-100"
      : onField
        ? "bg-zinc-800 text-zinc-200"
        : "bg-zinc-800/60 text-zinc-400";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-3 rounded-lg text-left active:scale-[0.97] transition-transform ${bg} min-h-[48px]`}
    >
      {player.shirtNumber != null && <span className="text-sm font-bold opacity-70 w-6 text-right shrink-0">{player.shirtNumber}</span>}
      <span className="text-sm font-medium truncate">{player.playerName}</span>
      {onField && <span className="ml-auto text-[10px] text-emerald-400 uppercase tracking-wide shrink-0">On field</span>}
    </button>
  );
}

// --- Confirmation Dialog ---
function ConfirmDialog({ open, onConfirm, onCancel, title, children }: { open: boolean; onConfirm: () => void; onCancel: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/70" onClick={onCancel} aria-hidden />
      <div className="relative z-10 bg-zinc-900 rounded-2xl border border-zinc-700 p-5 mx-4 max-w-sm w-full" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
        <h3 className="text-base font-semibold text-zinc-100 mb-2">{title}</h3>
        <div className="text-sm text-zinc-300 mb-4">{children}</div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 px-4 rounded-lg bg-zinc-800 text-zinc-300 font-medium min-h-[48px]">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium min-h-[48px]">Confirm</button>
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
  const color = status === "offline" ? "text-amber-400" : status === "error" ? "text-red-400" : "text-zinc-400";
  return <div className={`text-[10px] ${color} text-center py-0.5`}>{label}</div>;
}

// --- Main Component ---
export function LiveMatchClient({ matchId, teamName, opponentName, contextLabel, periodConfig, actions }: LiveMatchClientProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [onFieldIds, setOnFieldIds] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState<MatchClockState>(createInitialClockState());
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
  const onFieldPlayers = useMemo(() => squad.filter((p) => onFieldIds.has(p.playerId)), [squad, onFieldIds]);
  const benchPlayers = useMemo(() => squad.filter((p) => !onFieldIds.has(p.playerId)), [squad, onFieldIds]);
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

  useEffect(() => {
    if (!sessionActive) return;
    let mounted = true;
    async function fetchEvents() {
      const result = await actions.getRecentEvents(matchId, 20);
      if (mounted && result.success && result.data) {
        setRecentEvents(result.data);
      }
    }
    fetchEvents();
    const interval = setInterval(fetchEvents, 5_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [sessionActive, matchId, actions]);

  // Sync on reconnect
  useEffect(() => {
    const handleOnline = () => { syncUnsyncedEvents(); };
    window.addEventListener("online", handleOnline);
    const handleVisibility = () => { if (!document.hidden) syncUnsyncedEvents(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncUnsyncedEvents]);

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
    // Try syncing before ending
    await syncUnsyncedEvents();
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
      <div className="flex items-center justify-center min-h-[100dvh] bg-zinc-950">
        <p className="text-zinc-400">Loading match data...</p>
      </div>
    );
  }

  if (!sessionActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-zinc-950 p-6 space-y-6" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">{teamName}</h1>
          <p className="text-zinc-400 mt-1 text-lg">vs {opponentName}</p>
          {contextLabel && <p className="text-sm text-zinc-500 mt-1">{contextLabel}</p>}
        </div>
        <button
          onClick={handleStartSession}
          className="w-full max-w-xs px-8 py-5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-lg font-semibold rounded-xl transition-colors min-h-[56px]"
        >
          Start live reporting
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Scoreboard */}
      <div className="sticky top-0 z-30 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center px-3 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-xs font-medium text-zinc-400 truncate">{teamName}</div>
            <div className="text-4xl font-bold text-emerald-400 tabular-nums leading-tight">{goalsFor}</div>
          </div>
          <div className="shrink-0">
            <LiveClock clock={clock} periodConfig={periodConfig} />
          </div>
          <div className="flex-1 min-w-0 text-center">
            <div className="text-xs font-medium text-zinc-400 truncate">{opponentName}</div>
            <div className="text-4xl font-bold text-zinc-300 tabular-nums leading-tight">{goalsAgainst}</div>
          </div>
        </div>
        <SyncStatusIndicator status={syncStatus} pendingCount={unsyncedCount} />
      </div>

      {/* Period control */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <button
          onClick={() => handlePeriodAdvance()}
          disabled={isOver}
          className={`w-full py-3 px-4 rounded-lg text-sm font-semibold min-h-[48px] transition-colors ${
            isOver
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : isPlayingPeriod(clock.period, periodConfig)
                ? "bg-amber-900/60 text-amber-200 hover:bg-amber-800/60 active:bg-amber-900/80"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-800"
          }`}
        >
          {periodActionLabel}
        </button>
      </div>

      {/* Last action feedback */}
      {lastAction && (
        <div className="mx-3 mt-2 px-3 py-2 bg-emerald-900/40 border border-emerald-700/50 rounded-lg flex items-center justify-between gap-2">
          <span className="text-sm text-emerald-200">{lastAction.label}</span>
          {lastAction.undoLabel && lastAction.undoEventId !== undefined && (
            <button
              onClick={() => handleUndo(lastAction.undoEventId!)}
              className="text-xs text-amber-300 hover:text-amber-200 font-semibold whitespace-nowrap min-h-[36px] px-2"
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
          className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded-xl font-bold text-base min-h-[64px] transition-colors"
        >
          Goal for us
        </button>
        <button
          onClick={handleGoalAgainst}
          className="flex-1 py-4 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-zinc-200 rounded-xl font-bold text-base min-h-[64px] transition-colors"
        >
          Goal for them
        </button>
      </div>

      {/* Secondary controls */}
      <div className="px-3 pt-2 flex gap-2">
        <button
          onClick={handleStartRotation}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold min-h-[48px] transition-colors ${
            rotationMode ? "bg-blue-800/80 text-blue-200" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          Rotation
        </button>
        <button
          onClick={() => handleFairPlayStart(true)}
          className="flex-1 py-2.5 bg-green-900/50 text-green-300 hover:bg-green-800/50 active:bg-green-900/70 rounded-lg text-sm font-semibold min-h-[48px] transition-colors"
        >
          Fair play +
        </button>
        <button
          onClick={handleMomentMarked}
          className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg text-sm font-semibold min-h-[48px] transition-colors"
        >
          Mark moment
        </button>
      </div>

      {/* Fair play concern */}
      <div className="px-3 pt-1">
        <button
          onClick={() => handleFairPlayStart(false)}
          className="w-full py-2 text-sm text-red-400 bg-red-950/40 hover:bg-red-900/40 rounded-lg min-h-[44px] transition-colors"
        >
          Fair play concern
        </button>
      </div>

      {/* On-field overview */}
      {onFieldPlayers.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">On field ({onFieldPlayers.length})</h3>
            <span className="text-[10px] text-zinc-500">{benchPlayers.length} bench</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {onFieldPlayers.map((p) => (
              <span key={p.playerId} className="inline-flex items-center px-1.5 py-0.5 text-[11px] bg-emerald-900/40 text-emerald-200 rounded">
                {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                {p.playerName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent events with undo */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Recent events</h3>
        {mergedEvents.length === 0 ? (
          <p className="text-xs text-zinc-600">No events recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {mergedEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-1.5 px-2 bg-zinc-900/80 rounded text-xs">
                <div className="min-w-0">
                  <span className="text-zinc-300">{getEventTypeLabel(event.eventType)}</span>
                  {event.isReversed && <span className="text-red-400 ml-1 text-[10px]">reversed</span>}
                  {event.isCorrected && <span className="text-amber-400 ml-1 text-[10px]">corrected</span>}
                </div>
                {!event.isReversed && LIVE_EVENT_TYPES_THAT_ARE_CORRECTABLE.has(event.eventType) && (
                  <button
                    onClick={() => handleUndo(event.id)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 shrink-0 ml-2 min-h-[36px] px-1"
                  >
                    Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finish button */}
      <div className="px-3 py-3 border-t border-zinc-800" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={() => setConfirmDialog({ type: "end" })}
          className="w-full py-3 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg min-h-[48px] transition-colors"
        >
          Finish live reporting
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-900/30 border-t border-red-800" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:text-red-100">Dismiss</button>
        </div>
      )}

      {/* Bottom sheets */}

      {/* Scorer selection */}
      <BottomSheet open={goalFlow === "scorer_select" && sheet === "scorer"} onClose={() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); }} title="Who scored?">
        <div className="space-y-1.5">
          <button onClick={() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); setSheet(null); if (goalFlowTimerRef.current) clearTimeout(goalFlowTimerRef.current); }} className="w-full py-2.5 px-4 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium min-h-[48px]">
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
          <button onClick={() => handleAssistSelect(null)} className="w-full py-2.5 px-4 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium min-h-[48px]">
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
          )) : squad.map((p) => (
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

      {/* Fair play player selection */}
      <BottomSheet open={fairPlayFlow === "player_select" && sheet === "fair_play_player"} onClose={() => { setFairPlayFlow("idle"); setFairPlayPlayerId(null); setSheet(null); }} title={isPositive ? "Which player? (positive)" : "Which player? (concern)"}>
        <div className="space-y-1.5">
          <button onClick={() => handleFairPlayPlayer(null)} className="w-full py-2.5 px-4 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium min-h-[48px]">
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
              className={`w-full py-3 px-4 rounded-lg text-sm font-medium min-h-[48px] text-left transition-colors ${
                isPositive ? "bg-green-900/40 text-green-300 hover:bg-green-800/40" : "bg-red-900/40 text-red-300 hover:bg-red-800/40"
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
          {unsyncedCount > 0 && <p className="text-amber-400">{unsyncedCount} event{unsyncedCount > 1 ? "s" : ""} waiting to sync</p>}
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