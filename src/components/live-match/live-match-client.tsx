"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GOAL_DETAIL_INACTIVITY_TIMEOUT_MS } from "@/lib/live-match/live-match-types";
import {
  createInitialClockState,
  getElapsedMs,
  formatElapsedMs,
  advancePeriod,
  isPlayingPeriod,
  isMatchOver,
} from "@/lib/live-match/match-clock";
import { getEventTypeLabel, getFairPlayCategoryLabel } from "@/lib/live-match/live-match-domain";
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";
import type { PeriodConfig } from "@/lib/live-match/period-config";

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
  }) => Promise<{ success: boolean; error?: string }>;
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
}

export interface LiveMatchClientProps {
  matchId: string;
  teamName: string;
  opponentName: string;
  contextLabel: string | null;
  periodConfig: PeriodConfig[];
  actions: LiveMatchActions;
  coachId: string;
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

export function LiveMatchClient({ matchId, teamName, opponentName, contextLabel, periodConfig, actions }: LiveMatchClientProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [onFieldIds, setOnFieldIds] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState(createInitialClockState());
  const [goalsFor, setGoalsFor] = useState(0);
  const [goalsAgainst, setGoalsAgainst] = useState(0);
  const [recentEvents, setRecentEvents] = useState<LiveEventSummary[]>([]);
  const [goalFlow, setGoalFlow] = useState<GoalFlowStep>("idle");
  const [goalFlowPlayerId, setGoalFlowPlayerId] = useState<string | null>(null);
  const [fairPlayFlow, setFairPlayFlow] = useState<FairPlayFlowStep>("idle");
  const [fairPlayPlayerId, setFairPlayPlayerId] = useState<string | null>(null);
  const [isPositive, setIsPositive] = useState(true);
  const [rotationMode, setRotationMode] = useState(false);
  const [outPlayerId, setOutPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [goalFlowTimer, setGoalFlowTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const clockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadPreMatch() {
      setLoading(true);
      const result = await actions.getPreMatchPackage(matchId);
      if (result.success && result.data) {
        const loadedSquad = result.data.squad;
        setSquad(loadedSquad);
        setOnFieldIds(new Set(loadedSquad.filter((p) => p.startingOnField).map((p) => p.playerId)));
        if (result.data.activeSession) {
          setSessionId(result.data.activeSession.id);
          setSessionActive(true);
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
        await actions.heartbeat(sessionId);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [sessionActive, sessionId, actions]);

  useEffect(() => {
    if (clock.running) {
      clockIntervalRef.current = setInterval(() => {
        setClock((prev) => ({ ...prev }));
      }, 1000);
    } else {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    }
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [clock.running]);

  useEffect(() => {
    if (!sessionActive) return;
    async function fetchEvents() {
      const result = await actions.getRecentEvents(matchId, 10);
      if (result.success && result.data) {
        setRecentEvents(result.data);
      }
    }
    fetchEvents();
    const interval = setInterval(fetchEvents, 5_000);
    return () => clearInterval(interval);
  }, [sessionActive, matchId, actions]);

  const onFieldPlayers = useMemo(
    () => squad.filter((p) => onFieldIds.has(p.playerId)),
    [squad, onFieldIds],
  );

  const benchPlayers = useMemo(
    () => squad.filter((p) => !onFieldIds.has(p.playerId)),
    [squad, onFieldIds],
  );

  const sortedPlayersForScorer = useMemo(
    () => [...onFieldPlayers, ...benchPlayers],
    [onFieldPlayers, benchPlayers],
  );

  const handleStartSession = useCallback(async () => {
    setIsPending(true);
    const result = await actions.startSession(matchId);
    if (result.success && result.data) {
      setSessionId(result.data.id);
      setSessionActive(true);
      setError(null);
    } else {
      setError(result.error ?? "Failed to start session");
    }
    setIsPending(false);
  }, [matchId, actions]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    setIsPending(true);
    const result = await actions.endSession(sessionId);
    if (result.success) {
      setSessionActive(false);
      setSessionId(null);
      if (result.data?.reportId && actions.reportUrl) {
        window.location.href = actions.reportUrl(result.data.reportId);
      }
    } else {
      setError(result.error ?? "Failed to end session");
    }
    setIsPending(false);
  }, [sessionId, actions]);

  const recordEvent = useCallback(
    async (eventType: string, extra?: { playerId?: string; secondaryPlayerId?: string; period?: string; matchSeconds?: number; correctionType?: string; correctsEventId?: string; payload?: Record<string, unknown> }) => {
      if (!sessionId) return;
      const clientEventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setIsPending(true);
      const result = await actions.recordEvent({
        matchId,
        sessionId,
        eventType,
        clientEventId,
        ...extra,
      });
      if (!result.success) {
        setError(result.error ?? "Failed to record event");
      }
      setIsPending(false);
    },
    [matchId, sessionId, actions],
  );

  const handlePeriodAdvance = useCallback(() => {
    const next = advancePeriod(clock, periodConfig);
    setClock(next);

    const periodEvents: Record<string, string> = {};
    for (const p of periodConfig) {
      if (p.key === "BEFORE") { periodEvents[p.key] = "MATCH_START"; }
      else if (p.type === "playing") { periodEvents[p.key] = "PERIOD_START"; }
      else if (p.key === "FULL_TIME") { periodEvents[p.key] = "MATCH_END"; }
      else { periodEvents[p.key] = "PERIOD_END"; }
    }
    periodEvents["FULL_TIME"] = "MATCH_END";

    const currentPeriodEvent = periodEvents[next.period];
    if (currentPeriodEvent && sessionId) {
      recordEvent(currentPeriodEvent, { period: next.period });
    }
  }, [clock, sessionId, recordEvent, periodConfig]);

  const handleGoalFor = useCallback(() => {
    setGoalsFor((prev) => prev + 1);
    recordEvent("GOAL_FOR", { period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
    setGoalFlow("scorer_select");
    if (goalFlowTimer) clearTimeout(goalFlowTimer);
    const timer = setTimeout(() => {
      setGoalFlow("idle");
      setGoalFlowPlayerId(null);
    }, GOAL_DETAIL_INACTIVITY_TIMEOUT_MS);
    setGoalFlowTimer(timer);
  }, [clock, recordEvent, goalFlowTimer]);

  const handleGoalAgainst = useCallback(() => {
    setGoalsAgainst((prev) => prev + 1);
    recordEvent("GOAL_AGAINST", { period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
  }, [clock, recordEvent]);

  const handleScorerSelect = useCallback(
    (playerId: string) => {
      setGoalFlowPlayerId(playerId);
      recordEvent("SCORER_SET", { playerId, period: clock.period });
      setGoalFlow("assist_select");
      if (goalFlowTimer) clearTimeout(goalFlowTimer);
      const timer = setTimeout(() => {
        setGoalFlow("idle");
        setGoalFlowPlayerId(null);
      }, GOAL_DETAIL_INACTIVITY_TIMEOUT_MS);
      setGoalFlowTimer(timer);
    },
    [clock, recordEvent, goalFlowTimer],
  );

  const handleAssistSelect = useCallback(
    (playerId: string | null) => {
      if (playerId) {
        recordEvent("ASSIST_SET", { playerId, secondaryPlayerId: goalFlowPlayerId ?? undefined, period: clock.period });
      }
      setGoalFlow("idle");
      setGoalFlowPlayerId(null);
      if (goalFlowTimer) clearTimeout(goalFlowTimer);
    },
    [clock, recordEvent, goalFlowPlayerId, goalFlowTimer],
  );

  const handleNoAssist = useCallback(() => {
    handleAssistSelect(null);
  }, [handleAssistSelect]);

  const handleMomentMarked = useCallback(() => {
    recordEvent("MOMENT_MARKED", { period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
  }, [clock, recordEvent]);

  const handleFairPlayStart = useCallback((positive: boolean) => {
    setIsPositive(positive);
    setFairPlayFlow("player_select");
  }, []);

  const handleFairPlayPlayer = useCallback(
    (playerId: string | null) => {
      setFairPlayPlayerId(playerId);
      setFairPlayFlow("category_select");
    },
    [],
  );

  const handleFairPlayCategory = useCallback(
    (category: string) => {
      recordEvent(isPositive ? "FAIR_PLAY_POSITIVE" : "FAIR_PLAY_CONCERN", {
        playerId: fairPlayPlayerId ?? undefined,
        period: clock.period,
        payload: { category },
      });
      setFairPlayFlow("idle");
      setFairPlayPlayerId(null);
    },
    [isPositive, fairPlayPlayerId, clock, recordEvent],
  );

  const handleUndo = useCallback(
    async (eventId: string) => {
      if (!sessionId) return;
      const clientEventId = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setIsPending(true);
      await actions.recordEvent({
        matchId,
        sessionId,
        eventType: "EVENT_REVERSED",
        correctsEventId: eventId,
        correctionType: "REVERSAL",
        clientEventId,
      });
      setIsPending(false);
    },
    [matchId, sessionId, actions],
  );

  const handleRotationOut = useCallback((playerId: string) => {
    setOutPlayerId(playerId);
  }, []);

  const handleRotationIn = useCallback(
    async (inPlayerId: string) => {
      if (!outPlayerId) return;
      await recordEvent("ROTATION_OUT", { playerId: outPlayerId, period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
      await recordEvent("ROTATION_IN", { playerId: inPlayerId, period: clock.period, matchSeconds: getElapsedMs(clock, Date.now()) });
      setOnFieldIds((prev) => {
        const next = new Set(prev);
        next.delete(outPlayerId);
        next.add(inPlayerId);
        return next;
      });
      setOutPlayerId(null);
      setRotationMode(false);
    },
    [outPlayerId, clock, recordEvent],
  );

  const elapsedMs = getElapsedMs(clock, Date.now());
  const periodLabel = (() => {
    const labels: Record<string, string> = {};
    for (const p of periodConfig) {
      labels[p.key] = p.label;
    }
    return labels[clock.period] ?? clock.period;
  })();
  const isOver = isMatchOver(clock.period);
  const hasLineup = onFieldPlayers.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <p className="text-zinc-400">Loading match data...</p>
      </div>
    );
  }

  if (!sessionActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">{teamName}</h1>
          <p className="text-zinc-400 mt-1">vs {opponentName}</p>
          {contextLabel && <p className="text-sm text-zinc-500 mt-1">{contextLabel}</p>}
        </div>
        <button
          onClick={handleStartSession}
          disabled={isPending}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-semibold rounded-xl disabled:opacity-50 transition-colors"
        >
          {isPending ? "Starting..." : "Start live reporting"}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{teamName}</h1>
            <p className="text-sm text-zinc-400">vs {opponentName}</p>
          </div>
          <button
            onClick={handleEndSession}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-red-900/60 text-red-300 rounded-lg hover:bg-red-800/60 disabled:opacity-50"
          >
            End
          </button>
        </div>
      </div>

      {/* Score + Clock */}
      <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-3xl font-bold">{teamName}</div>
            <div className="text-5xl font-bold text-emerald-400">{goalsFor}</div>
          </div>
          <div className="text-center px-4">
            <div className="text-sm text-zinc-500 mb-1">{periodLabel}</div>
            <div className="text-2xl font-mono text-zinc-300">{formatElapsedMs(elapsedMs)}</div>
            <button
              onClick={handlePeriodAdvance}
              className="mt-2 px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
            >
              {isPlayingPeriod(clock.period, periodConfig) ? "End period" : isOver ? "Match ended" : "Next period"}
            </button>
          </div>
          <div className="text-center flex-1">
            <div className="text-3xl font-bold text-zinc-400">{opponentName}</div>
            <div className="text-5xl font-bold text-zinc-400">{goalsAgainst}</div>
          </div>
        </div>
      </div>

      {/* On-field / Bench overview */}
      {hasLineup && (
        <div className="px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">On field ({onFieldPlayers.length})</h3>
            <span className="text-xs text-zinc-500">{benchPlayers.length} bench</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {onFieldPlayers.map((p) => (
              <span key={p.playerId} className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-900/40 text-emerald-200 rounded">
                {p.shirtNumber != null && <span className="mr-1 opacity-70">{p.shirtNumber}</span>}
                {p.playerName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Primary Actions */}
      <div className="px-4 py-3 grid grid-cols-5 gap-2">
        <button
          onClick={handleGoalFor}
          className="flex flex-col items-center justify-center py-3 bg-emerald-900/60 text-emerald-300 rounded-xl hover:bg-emerald-800/60 active:scale-95 transition-all"
        >
          <span className="text-lg font-bold">Goal us</span>
          <span className="text-xs opacity-70">1 tap</span>
        </button>
        <button
          onClick={handleGoalAgainst}
          className="flex flex-col items-center justify-center py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 active:scale-95 transition-all"
        >
          <span className="text-lg font-bold">Goal them</span>
          <span className="text-xs opacity-70">1 tap</span>
        </button>
        <button
          onClick={() => setRotationMode(!rotationMode)}
          className={`flex flex-col items-center justify-center py-3 rounded-xl active:scale-95 transition-all ${rotationMode ? "bg-blue-800/80 text-blue-200" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
        >
          <span className="text-lg font-bold">Rotation</span>
          <span className="text-xs opacity-70">Swap</span>
        </button>
        <button
          onClick={() => handleFairPlayStart(true)}
          className="flex flex-col items-center justify-center py-3 bg-green-900/50 text-green-300 rounded-xl hover:bg-green-800/50 active:scale-95 transition-all"
        >
          <span className="text-sm font-bold">Fair play</span>
          <span className="text-xs opacity-70">+</span>
        </button>
        <button
          onClick={handleMomentMarked}
          className="flex flex-col items-center justify-center py-3 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 active:scale-95 transition-all"
        >
          <span className="text-sm font-bold">Mark</span>
          <span className="text-xs opacity-70">moment</span>
        </button>
      </div>

      {/* Fair Play Player Selection */}
      {fairPlayFlow === "player_select" && (
        <div className="px-4 py-2 bg-green-950/30 border-t border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-300">Which player?</h3>
            <button onClick={() => { setFairPlayFlow("idle"); setFairPlayPlayerId(null); }} className="text-xs text-zinc-400 hover:text-zinc-200">Skip</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
            {sortedPlayersForScorer.map((p) => (
              <button
                key={p.playerId}
                onClick={() => handleFairPlayPlayer(p.playerId)}
                className={`px-2 py-1.5 text-xs rounded hover:bg-green-800/50 truncate ${onFieldIds.has(p.playerId) ? "bg-zinc-800 text-zinc-200" : "bg-zinc-800/60 text-zinc-400"}`}
              >
                {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                {p.playerName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Goal Scorer Selection */}
      {goalFlow === "scorer_select" && (
        <div className="px-4 py-2 bg-emerald-950/50 border-t border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-emerald-300">Who scored?</h3>
            <button onClick={() => { setGoalFlow("idle"); setGoalFlowPlayerId(null); }} className="text-xs text-zinc-400 hover:text-zinc-200">Skip</button>
          </div>
          {hasLineup && <p className="text-xs text-zinc-500 mb-1">On-field players shown first</p>}
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
            {sortedPlayersForScorer.map((p, i) => (
              <button
                key={p.playerId}
                onClick={() => handleScorerSelect(p.playerId)}
                className={`px-2 py-1.5 text-xs rounded hover:bg-emerald-800/50 truncate ${i < onFieldPlayers.length ? "bg-zinc-800 text-zinc-200" : "bg-zinc-800/60 text-zinc-400"}`}
              >
                {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                {p.playerName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assist Selection */}
      {goalFlow === "assist_select" && (
        <div className="px-4 py-2 bg-emerald-950/30 border-t border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-emerald-300">Assist?</h3>
            <button onClick={handleNoAssist} className="text-xs text-zinc-400 hover:text-zinc-200">No assist</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
            {sortedPlayersForScorer.filter((p) => p.playerId !== goalFlowPlayerId).map((p, i) => {
              const onFieldCount = sortedPlayersForScorer.filter((sp) => sp.playerId !== goalFlowPlayerId && onFieldIds.has(sp.playerId)).length;
              return (
                <button
                  key={p.playerId}
                  onClick={() => handleAssistSelect(p.playerId)}
                  className={`px-2 py-1.5 text-xs rounded hover:bg-emerald-800/50 truncate ${i < onFieldCount ? "bg-zinc-800 text-zinc-200" : "bg-zinc-800/60 text-zinc-400"}`}
                >
                  {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                  {p.playerName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fair Play Concern */}
      <button
        onClick={() => handleFairPlayStart(false)}
        className="mx-4 mb-2 px-3 py-2 text-sm bg-red-900/40 text-red-300 rounded-lg hover:bg-red-800/40 transition-colors"
      >
        Fair play concern
      </button>

      {/* Rotation Panel */}
      {rotationMode && (
        <div className="px-4 py-2 bg-blue-950/30 border-t border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-blue-300 mb-2">
            {outPlayerId ? "Player coming on (from bench)" : "Player going off (from field)"}
          </h3>
          {outPlayerId ? (
            <>
              <p className="text-xs text-zinc-500 mb-1">
                Replacing: <span className="text-blue-300">{squad.find((p) => p.playerId === outPlayerId)?.playerName}</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                {benchPlayers.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => handleRotationIn(p.playerId)}
                    className="px-2 py-1.5 text-xs bg-zinc-800 text-zinc-200 rounded hover:bg-blue-800/50 truncate"
                  >
                    {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                    {p.playerName}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
              {onFieldPlayers.length > 0 ? (
                onFieldPlayers.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => handleRotationOut(p.playerId)}
                    className="px-2 py-1.5 text-xs bg-emerald-900/40 text-emerald-200 rounded hover:bg-blue-800/50 truncate"
                  >
                    {p.shirtNumber != null && <span className="mr-0.5 opacity-70">{p.shirtNumber}</span>}
                    {p.playerName}
                  </button>
                ))
              ) : (
                squad.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => handleRotationOut(p.playerId)}
                    className="px-2 py-1.5 text-xs bg-zinc-800 text-zinc-200 rounded hover:bg-blue-800/50 truncate"
                  >
                    {p.playerName}
                  </button>
                ))
              )}
            </div>
          )}
          {outPlayerId && (
            <button onClick={() => setOutPlayerId(null)} className="mt-2 text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
          )}
        </div>
      )}

      {/* Fair Play Category Selection */}
      {fairPlayFlow === "category_select" && (
        <div className="px-4 py-2 bg-zinc-900 border-t border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">
            {isPositive ? "Positive fair play" : "Fair play concern"}
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(isPositive ? FAIR_PLAY_POSITIVE_CATEGORIES : FAIR_PLAY_CONCERN_CATEGORIES).map((cat) => (
              <button
                key={cat}
                onClick={() => handleFairPlayCategory(cat)}
                className={`px-2 py-1.5 text-xs rounded truncate ${isPositive ? "bg-green-900/40 text-green-300 hover:bg-green-800/40" : "bg-red-900/40 text-red-300 hover:bg-red-800/40"}`}
              >
                {getFairPlayCategoryLabel(cat)}
              </button>
            ))}
          </div>
          <button onClick={() => { setFairPlayFlow("idle"); setFairPlayPlayerId(null); }} className="mt-2 text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
        </div>
      )}

      {/* Recent Events */}
      <div className="flex-1 px-4 py-2 overflow-y-auto">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Recent events</h3>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-zinc-600">No events recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {recentEvents.slice(-5).reverse().map((event) => (
              <div key={event.id} className="flex items-center justify-between py-1.5 px-2 bg-zinc-900 rounded text-sm">
                <div>
                  <span className="text-zinc-300">{getEventTypeLabel(event.eventType)}</span>
                  {event.isReversed && <span className="text-red-400 ml-1">reversed</span>}
                  {event.isCorrected && <span className="text-amber-400 ml-1">corrected</span>}
                </div>
                {!event.isReversed && (
                  <button
                    onClick={() => handleUndo(event.id)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:text-red-100">Dismiss</button>
        </div>
      )}
    </div>
  );
}