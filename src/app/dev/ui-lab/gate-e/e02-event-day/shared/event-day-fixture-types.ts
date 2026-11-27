import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
// Type-only import: `event-match-stats.ts` imports the server `db` client, so a VALUE import
// from it would pull Prisma/pg into this client bundle. `import type` is erased at compile time.
import type { EventMatchWithReport } from "@/lib/stats/event-match-stats";
import type { MatchPeriod } from "@/generated/prisma/client";

/**
 * Gate E W2 — E02 (Events / Event day). The fixture graph every E02 candidate state is built
 * from. Deliberately the SAME record shapes production already uses — no alternative Event
 * domain model:
 *
 * - `matches` are canonical `EventMatchWithReport` records (`src/lib/stats/event-match-stats.ts`,
 *   the exact type `listEventMatchesAction()` returns to `EventDayTimeline`/`EventMatchesTab`),
 *   plus the `eventId` column every real `EventMatch` row carries (Prisma `EventMatch.eventId`)
 *   so parent-Event membership is checkable instead of assumed.
 * - `liveSessions` is the canonical `EventLiveMatchSession` evidence (status + clock) from which
 *   production's private `deriveEventLiveState()` derives `isLive`/`livePrimaryAction`. The
 *   fixture keeps the raw session next to the derived fields so the integrity tests can prove
 *   `isLive` is backed by an ACTIVE session rather than inferred from the clock.
 * - `event`/`squads` carry only fields that exist on the real `Event`/`EventSquad` models.
 *   No venue map, agenda, meeting time, warm-up or transport item exists anywhere in this graph
 *   because no such record exists in the Matchboard domain.
 */
export type E02EventStatus = "DRAFT" | "FINALIZED";

export type E02Event = {
  id: string;
  name: string;
  /** Prisma `EventType`. */
  eventType: "CUP" | "TOURNAMENT" | "FRIENDLY_DAY" | "OTHER";
  /** Prisma `GameFormat`. */
  gameFormat: string;
  startsAt: Date;
  endsAt: Date | null;
  status: E02EventStatus;
  finalizedAt: Date | null;
};

export type E02EventSquad = {
  id: string;
  eventId: string;
  name: string;
};

export type E02EventMatchRecord = EventMatchWithReport & { eventId: string };

export type E02LiveSessionRecord = {
  eventMatchId: string;
  status: "ACTIVE" | "ENDED";
  clockPeriod: MatchPeriod;
  clockRunning: boolean;
};

export type E02EventDayFixture = {
  identity: FixtureIdentity;
  /** The single frozen reference instant every classification and test uses. */
  now: Date;
  event: E02Event;
  /** In the Event's own squad order (the deterministic tie-break for simultaneous kickoffs). */
  squads: E02EventSquad[];
  matches: E02EventMatchRecord[];
  liveSessions: E02LiveSessionRecord[];
};
