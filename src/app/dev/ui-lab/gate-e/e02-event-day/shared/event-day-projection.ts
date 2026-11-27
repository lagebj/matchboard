import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import type { TimelineNodeState } from "@/components/touchline/timeline/touchline-timeline";
import { MATCHBOARD_DISPLAY_TIMEZONE } from "@/lib/date-utils";
import type { E02Event, E02EventMatchRecord, E02EventSquad } from "./event-day-fixture-types";

/**
 * Gate E W2 — E02 Event-day projection (UI-Lab-only, pure, DB-free).
 *
 * Production's `EventDayTimeline` (`src/components/events/event-day-timeline.tsx`) is the
 * primary reference, but it cannot be mounted with fixture records: it self-fetches through the
 * `listEventMatchesAction()` Server Action inside a `useEffect`, its lifecycle derivation
 * (`deriveEventMatchLifecycle`) is module-private, and it reads `new Date()` at render. This
 * module is the smallest fixture-safe stand-in for that ONE function body: it feeds canonical
 * `EventMatchWithReport` records through the real, unmodified `buildMatchPresentation()` so the
 * real `TouchlineTimeline`/`TimelineItem`/`ScorebookMatchRow` render them.
 *
 * Where this projection deliberately DIFFERS from production's current timeline (every
 * difference is an E02 data-truth requirement, recorded in
 * `docs/ui-lab/gate-e-w2-candidates/TEMPORAL_AND_LIFECYCLE_AUDIT.md`, and none is claimed as
 * shipped behaviour):
 *
 * 1. Canonical `isLive` (an ACTIVE live session) yields `live`. Production never returns `live`
 *    — an in-progress match falls through to `played` ("FT").
 * 2. `REPORTED` is a completed result (ADR-0001 §2, ADR-0003 §5). Production groups it with
 *    `DRAFT` as `report_incomplete`.
 * 3. A `DRAFT` report's score is never passed to the presentation (ADR-0001: "DRAFT reports show
 *    nothing"), so no draft value can appear as a final score or a Win/Draw/Loss. Production
 *    passes the draft score and outcome through, rendering e.g. "FT · Win".
 * 4. A cancelled match is never "Later": it gets a muted node and a CANCELLED kicker.
 *    Production labels a cancelled match "LATER" even after its kickoff has passed.
 * 5. Simultaneous kickoffs are ordered by the Event's own squad order, then match id. Production
 *    sorts by kickoff only, which leaves equal kickoffs in database return order.
 * 6. Every upcoming match sharing the earliest upcoming kickoff is NEXT (two squads can both
 *    play next at the same time). Production marks only the first in its unstable order.
 * 7. Times and dates are formatted in `MATCHBOARD_DISPLAY_TIMEZONE` (Europe/Oslo) explicitly.
 *    Production's `formatKickoffTime()` uses the browser's local zone, which is only correct
 *    because production renders this list client-side after its fetch. A fixture page renders
 *    on the server first, so local-zone formatting would differ between server (UTC), CI (UTC)
 *    and the coach's browser. `kickoffDate`/`kickoffTime` on the real presentation object are
 *    replaced with the Oslo values. No other presentation field is changed.
 */

export type E02ReportState = "NONE" | "DRAFT" | "REPORTED" | "LOCKED";

export type E02DayItem = {
  match: E02EventMatchRecord;
  squad: E02EventSquad | null;
  lifecycle: MatchLifecycleStatus;
  reportState: E02ReportState;
  nodeState: TimelineNodeState;
  kicker: string | null;
  /** Short state label for the selected-match context, never colour-only. */
  stateLabel: string;
  isNext: boolean;
  timeLabel: string;
  dayKey: string;
  dayLabel: string;
  presentation: MatchPresentation;
  /** A quiet supporting line under the row, or null. */
  caption: string | null;
};

export type E02DaySummary = {
  total: number;
  results: number;
  lockedResults: number;
  reportedNotLocked: number;
  live: number;
  reportFollowUp: number;
  upcoming: number;
  cancelled: number;
};

export type E02SquadProgress = {
  squad: E02EventSquad;
  total: number;
  results: number;
  live: number;
  reportFollowUp: number;
  upcoming: number;
  cancelled: number;
  nextKickoffLabel: string | null;
};

export type E02EventDayProjection = {
  items: E02DayItem[];
  days: { dayKey: string; dayLabel: string; items: E02DayItem[] }[];
  summary: E02DaySummary;
  nextMatchIds: string[];
  squadProgress: E02SquadProgress[];
  selected: E02DayItem | null;
  /** A `match` URL value that is not a match of THIS event. Never silently re-parented. */
  rejectedSelectionId: string | null;
};

const osloTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: MATCHBOARD_DISPLAY_TIMEZONE,
});
const osloShortDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: MATCHBOARD_DISPLAY_TIMEZONE,
});
const osloLongDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: MATCHBOARD_DISPLAY_TIMEZONE,
});
const osloDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: MATCHBOARD_DISPLAY_TIMEZONE });

// Labels are assembled from `formatToParts()` rather than `format()` so the server (Node ICU) and
// the browser (Chromium ICU) produce byte-identical text — whole-string `format()` output (e.g.
// the comma after the weekday) differs between ICU versions and would cause hydration mismatches.
function parts(fmt: Intl.DateTimeFormat, d: Date): Record<string, string> {
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}

/** "12:40" in Europe/Oslo. */
export function formatOsloTime(d: Date): string {
  const p = parts(osloTime, d);
  return `${p.hour}:${p.minute}`;
}
/** "SAT 13 MAR" in Europe/Oslo — same shape as `formatMatchDateShort()`. */
export function formatOsloShortDate(d: Date): string {
  const p = parts(osloShortDate, d);
  return `${p.weekday} ${p.day} ${p.month}`.toUpperCase();
}
/** "Saturday 13 March 2027" in Europe/Oslo — the same fields as `formatKickoffDate()`. */
export function formatOsloLongDate(d: Date): string {
  const p = parts(osloLongDate, d);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}
/** "2027-03-13" — the Europe/Oslo display-day key (same policy as `getDisplayDateKey()`). */
export function osloDayKeyOf(d: Date): string {
  return osloDayKey.format(d);
}

export function reportStateOf(m: E02EventMatchRecord): E02ReportState {
  const s = m.report?.status;
  if (s === "DRAFT" || s === "REPORTED" || s === "LOCKED") return s;
  return "NONE";
}

/** Candidate lifecycle — see the module comment for the exact differences from production. */
export function deriveE02Lifecycle(m: E02EventMatchRecord, now: Date): MatchLifecycleStatus {
  if (m.status === "CANCELLED") return "cancelled";
  if (m.isLive) return "live";
  const report = reportStateOf(m);
  if (report === "LOCKED" || report === "REPORTED") return "done";
  if (report === "DRAFT") return "report_incomplete";
  if (m.startsAt.getTime() <= now.getTime()) return "played";
  return "planning_open";
}

function outcomeFor(our: number | null, opp: number | null): "WON" | "DRAWN" | "LOST" | null {
  if (our == null || opp == null) return null;
  if (our > opp) return "WON";
  if (our < opp) return "LOST";
  return "DRAWN";
}

/** Kickoff, then the Event's own squad order, then match id — never database return order. */
export function sortEventDayMatches(matches: E02EventMatchRecord[], squads: E02EventSquad[]): E02EventMatchRecord[] {
  const squadOrder = new Map(squads.map((s, i) => [s.id, i]));
  return [...matches].sort((a, b) => {
    const t = a.startsAt.getTime() - b.startsAt.getTime();
    if (t !== 0) return t;
    const sa = squadOrder.get(a.eventSquadId) ?? Number.MAX_SAFE_INTEGER;
    const sb = squadOrder.get(b.eventSquadId) ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function isUpcoming(m: E02EventMatchRecord, lifecycle: MatchLifecycleStatus): boolean {
  return lifecycle === "planning_open" && !m.report;
}

export function buildEventDayProjection({
  event,
  squads,
  matches,
  now,
  selectedMatchId,
}: {
  event: E02Event;
  squads: E02EventSquad[];
  matches: E02EventMatchRecord[];
  now: Date;
  selectedMatchId?: string | null;
}): E02EventDayProjection {
  const squadById = new Map(squads.map((s) => [s.id, s]));
  // Only this Event's own matches are ever projected — a record carrying another eventId is
  // excluded rather than shown under this Event's heading.
  const own = matches.filter((m) => m.eventId === event.id);
  const sorted = sortEventDayMatches(own, squads);

  const lifecycles = new Map(sorted.map((m) => [m.id, deriveE02Lifecycle(m, now)]));
  const upcoming = sorted.filter((m) => isUpcoming(m, lifecycles.get(m.id)!));
  const firstUpcomingAt = upcoming[0]?.startsAt.getTime() ?? null;
  const nextMatchIds =
    firstUpcomingAt == null ? [] : upcoming.filter((m) => m.startsAt.getTime() === firstUpcomingAt).map((m) => m.id);

  const items: E02DayItem[] = sorted.map((m) => {
    const lifecycle = lifecycles.get(m.id)!;
    const reportState = reportStateOf(m);
    const squad = squadById.get(m.eventSquadId) ?? null;
    const isNext = nextMatchIds.includes(m.id);
    const hasResult = lifecycle === "done";

    let nodeState: TimelineNodeState;
    let kicker: string | null;
    let stateLabel: string;
    let caption: string | null = null;
    switch (lifecycle) {
      case "cancelled":
        nodeState = "done";
        kicker = "CANCELLED";
        stateLabel = "Cancelled";
        break;
      case "live":
        nodeState = "live";
        kicker = "LIVE";
        stateLabel = "Live — reporting session active";
        break;
      case "played":
        nodeState = "current";
        kicker = "REPORT MISSING";
        stateLabel = "Kicked off — no report recorded";
        break;
      case "report_incomplete":
        nodeState = "current";
        kicker = "REPORT DRAFT";
        stateLabel = "Report draft — result not final";
        caption = "Draft report — score not final";
        break;
      case "done":
        nodeState = "done";
        kicker = null;
        stateLabel = reportState === "LOCKED" ? "Result recorded — report completed" : "Result recorded — report not locked";
        caption = reportState === "REPORTED" ? "Result reported · report not locked" : null;
        break;
      default:
        nodeState = isNext ? "next" : "later";
        kicker = isNext ? "NEXT" : "LATER";
        stateLabel = isNext ? "Next match" : "Scheduled";
    }

    const ourScore = hasResult ? (m.report?.ourScore ?? null) : null;
    const opponentScore = hasResult ? (m.report?.opponentScore ?? null) : null;
    const reportAttention =
      lifecycle === "played"
        ? { label: "Report missing", tone: "warning" as const }
        : lifecycle === "report_incomplete"
          ? { label: "Report draft", tone: "warning" as const }
          : null;

    const built = buildMatchPresentation({
      id: m.id,
      teamName: squad?.name ?? "Unknown squad",
      opponentName: m.opponentName,
      isHome: true,
      kickoffAt: m.startsAt,
      lifecycleStatus: lifecycle,
      ownGoals: ourScore,
      opponentGoals: opponentScore,
      outcome: outcomeFor(ourScore, opponentScore),
      reportAttention,
      cancelledReason: m.status === "CANCELLED" ? m.cancelledReason : null,
    });
    const presentation: MatchPresentation = {
      ...built,
      kickoffDate: formatOsloShortDate(m.startsAt),
      kickoffTime: formatOsloTime(m.startsAt),
    };

    return {
      match: m,
      squad,
      lifecycle,
      reportState,
      nodeState,
      kicker,
      stateLabel,
      isNext,
      timeLabel: formatOsloTime(m.startsAt),
      dayKey: osloDayKeyOf(m.startsAt),
      dayLabel: formatOsloLongDate(m.startsAt),
      presentation,
      caption,
    };
  });

  const days: E02EventDayProjection["days"] = [];
  for (const item of items) {
    const last = days[days.length - 1];
    if (last && last.dayKey === item.dayKey) last.items.push(item);
    else days.push({ dayKey: item.dayKey, dayLabel: item.dayLabel, items: [item] });
  }

  const count = (pred: (i: E02DayItem) => boolean, list = items) => list.filter(pred).length;
  const isFollowUp = (i: E02DayItem) => i.lifecycle === "played" || i.lifecycle === "report_incomplete";
  const summary: E02DaySummary = {
    total: items.length,
    results: count((i) => i.lifecycle === "done"),
    lockedResults: count((i) => i.lifecycle === "done" && i.reportState === "LOCKED"),
    reportedNotLocked: count((i) => i.lifecycle === "done" && i.reportState === "REPORTED"),
    live: count((i) => i.lifecycle === "live"),
    reportFollowUp: count(isFollowUp),
    upcoming: count((i) => i.lifecycle === "planning_open"),
    cancelled: count((i) => i.lifecycle === "cancelled"),
  };

  const squadProgress: E02SquadProgress[] = squads.map((squad) => {
    const mine = items.filter((i) => i.match.eventSquadId === squad.id);
    const nextUp = mine.find((i) => i.lifecycle === "planning_open");
    return {
      squad,
      total: mine.length,
      results: count((i) => i.lifecycle === "done", mine),
      live: count((i) => i.lifecycle === "live", mine),
      reportFollowUp: count(isFollowUp, mine),
      upcoming: count((i) => i.lifecycle === "planning_open", mine),
      cancelled: count((i) => i.lifecycle === "cancelled", mine),
      nextKickoffLabel: nextUp ? nextUp.timeLabel : null,
    };
  });

  const selected = selectedMatchId ? (items.find((i) => i.match.id === selectedMatchId) ?? null) : null;
  return {
    items,
    days,
    summary,
    nextMatchIds,
    squadProgress,
    selected,
    rejectedSelectionId: selectedMatchId && !selected ? selectedMatchId : null,
  };
}

/** "2 results · 1 live · 2 need report follow-up · 3 to come · 1 cancelled" — zero parts omitted. */
export function describeSummary(s: E02DaySummary): string {
  const parts: string[] = [];
  if (s.results) parts.push(`${s.results} result${s.results === 1 ? "" : "s"}`);
  if (s.live) parts.push(`${s.live} live`);
  if (s.reportFollowUp) parts.push(`${s.reportFollowUp} need${s.reportFollowUp === 1 ? "s" : ""} report follow-up`);
  if (s.upcoming) parts.push(`${s.upcoming} to come`);
  if (s.cancelled) parts.push(`${s.cancelled} cancelled`);
  return parts.join(" · ");
}

export const EVENT_TYPE_LABELS: Record<E02Event["eventType"], string> = {
  CUP: "Cup",
  TOURNAMENT: "Tournament",
  FRIENDLY_DAY: "Friendly day",
  OTHER: "Other",
};

export const EVENT_STATUS_LABELS: Record<E02Event["status"], string> = {
  DRAFT: "Draft",
  FINALIZED: "Finalised",
};

/** Same `REPORT_STATUS_LABELS` vocabulary `EventMatchesTab` shows coaches. */
export const REPORT_STATE_LABELS: Record<E02ReportState, string> = {
  NONE: "No report",
  DRAFT: "Draft",
  REPORTED: "Reported",
  LOCKED: "Completed",
};
