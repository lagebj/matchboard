/**
 * Browser-local "Since your last visit" snapshot/diff logic (ADR-0141,
 * `04_BROWSER_LOCAL_STATE.md` "Since your last visit"). Pure — no `localStorage`, no React, no
 * DB. The stored snapshot carries only identifiers/states (never names, notes, or recommendation
 * prose); the diff functions below resolve concrete display text using the *current* server data
 * the caller already has, never anything persisted in the snapshot itself.
 */

export type TodayVisitSnapshotV1 = {
  version: 1;
  seenAtMs: number;
  liveMatchIds: string[];
  matchKickoffById: Record<string, string | null>;
  reportStateByMatchId: Record<string, string>;
  planSignalKeys: string[];
  roundReadinessById: Record<string, { blocked: number; decisions: number }>;
};

/** The current-visit facts needed to build a snapshot and diff against a previous one. Supplied
 * by the caller from data the route already loaded — never independently queried here. */
export type TodayVisitCurrentFacts = {
  liveMatchIds: string[];
  matches: {
    matchId: string;
    kickoffIso: string | null;
    reportState: string;
    /** Resolvable display label, used only to render a diff row — never persisted. */
    label: string;
  }[];
  planSignals: {
    signalKey: string;
    /** Resolvable display title, used only to render a diff row — never persisted. */
    title: string;
  }[];
  rounds: {
    roundId: string;
    label: string;
    blocked: number;
    decisions: number;
  }[];
};

export type TodayVisitChangeRow = {
  kind: "NEWLY_LIVE" | "KICKOFF_CHANGED" | "REPORT_LIFECYCLE" | "NEW_SIGNAL" | "RESOLVED_SIGNAL" | "ROUND_READY";
  text: string;
};

const MAX_INITIAL_ROWS = 5;

export function buildTodayVisitSnapshot(facts: TodayVisitCurrentFacts, seenAtMs: number): TodayVisitSnapshotV1 {
  const matchKickoffById: Record<string, string | null> = {};
  const reportStateByMatchId: Record<string, string> = {};
  for (const m of facts.matches) {
    matchKickoffById[m.matchId] = m.kickoffIso;
    reportStateByMatchId[m.matchId] = m.reportState;
  }

  const roundReadinessById: Record<string, { blocked: number; decisions: number }> = {};
  for (const r of facts.rounds) {
    roundReadinessById[r.roundId] = { blocked: r.blocked, decisions: r.decisions };
  }

  return {
    version: 1,
    seenAtMs,
    liveMatchIds: [...facts.liveMatchIds],
    matchKickoffById,
    reportStateByMatchId,
    planSignalKeys: facts.planSignals.map((s) => s.signalKey),
    roundReadinessById,
  };
}

/** A report state counts as "completed" once it leaves draft/unresolved — matches product
 * terminology ("Reported"/"Locked"), never a raw enum value shown to the coach. */
const COMPLETED_REPORT_STATES = new Set(["REPORTED", "LOCKED"]);

export function diffTodayVisitSnapshots(
  previous: TodayVisitSnapshotV1 | null,
  current: TodayVisitCurrentFacts,
): { rows: TodayVisitChangeRow[]; overflowCount: number } {
  if (!previous) return { rows: [], overflowCount: 0 };

  const rows: TodayVisitChangeRow[] = [];

  // 1. Newly live.
  for (const m of current.matches) {
    if (current.liveMatchIds.includes(m.matchId) && !previous.liveMatchIds.includes(m.matchId)) {
      rows.push({ kind: "NEWLY_LIVE", text: `${m.label} is now live` });
    }
  }

  // 2. Kickoff changed.
  for (const m of current.matches) {
    const prevKickoff = previous.matchKickoffById[m.matchId];
    if (prevKickoff === undefined) continue;
    if (prevKickoff !== m.kickoffIso && prevKickoff != null && m.kickoffIso != null) {
      rows.push({
        kind: "KICKOFF_CHANGED",
        text: `${m.label} moved to ${formatKickoffTime(m.kickoffIso)} (was ${formatKickoffTime(prevKickoff)})`,
      });
    }
  }

  // 3. Report lifecycle changes.
  for (const m of current.matches) {
    const prevState = previous.reportStateByMatchId[m.matchId];
    if (prevState === undefined) continue;
    const wasComplete = COMPLETED_REPORT_STATES.has(prevState);
    const isComplete = COMPLETED_REPORT_STATES.has(m.reportState);
    if (!wasComplete && isComplete) {
      rows.push({ kind: "REPORT_LIFECYCLE", text: `${m.label} report submitted` });
    }
  }

  // 4. New plan-integrity signal.
  const previousSignalKeys = new Set(previous.planSignalKeys);
  for (const s of current.planSignals) {
    if (!previousSignalKeys.has(s.signalKey)) {
      rows.push({ kind: "NEW_SIGNAL", text: s.title });
    }
  }

  // 5. Resolved signal — aggregate only, never a guessed player/team name.
  const currentSignalKeys = new Set(current.planSignals.map((s) => s.signalKey));
  const resolvedCount = previous.planSignalKeys.filter((k) => !currentSignalKeys.has(k)).length;
  if (resolvedCount > 0) {
    rows.push({
      kind: "RESOLVED_SIGNAL",
      text: resolvedCount === 1 ? "A round-planning decision was resolved" : `${resolvedCount} round-planning decisions were resolved`,
    });
  }

  // 6. Round became ready — only when a more specific row above doesn't already explain it.
  for (const r of current.rounds) {
    const prevReadiness = previous.roundReadinessById[r.roundId];
    if (!prevReadiness) continue;
    const wasBlocked = prevReadiness.blocked > 0 || prevReadiness.decisions > 0;
    const isReady = r.blocked === 0 && r.decisions === 0;
    if (wasBlocked && isReady && resolvedCount === 0) {
      rows.push({ kind: "ROUND_READY", text: `${r.label} is now ready` });
    }
  }

  const overflowCount = Math.max(0, rows.length - MAX_INITIAL_ROWS);
  return { rows: rows.slice(0, MAX_INITIAL_ROWS + overflowCount), overflowCount };
}

function formatKickoffTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(date);
}
