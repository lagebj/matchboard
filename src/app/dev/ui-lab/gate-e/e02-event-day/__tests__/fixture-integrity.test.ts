import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import * as upcoming from "../upcoming/fixtures";
import * as mixed from "../mixed-progression/fixtures";
import * as completed from "../completed/fixtures";
import { buildEventDayProjection } from "../shared/event-day-projection";
import type { E02EventDayFixture } from "../shared/event-day-fixture-types";

/**
 * The 17 mandatory E02 fixture-integrity assertions
 * (`docs/ui-lab/gate-e-w2-candidates/DATA_TRUTH_AND_FIXTURES.md`), run against every child
 * candidate fixture. Expected values are derived independently from the raw records here —
 * never read back from the projection under test.
 */
const FIXTURES: { name: string; mod: { fixture: E02EventDayFixture; rawRecordsForHash: unknown } }[] = [
  { name: "UPCOMING", mod: upcoming },
  { name: "MIXED", mod: mixed },
  { name: "COMPLETED", mod: completed },
];

/** Independent Oslo wall-clock: every fixture day is 13 Mar 2027, CET (UTC+1), asserted below. */
function independentOsloHHMM(d: Date): string {
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(11, 16);
}

const ALLOWED_EVENT_KEYS = ["id", "name", "eventType", "gameFormat", "startsAt", "endsAt", "status", "finalizedAt"].sort();
const ALLOWED_MATCH_KEYS = [
  "id", "eventId", "eventSquadId", "category", "opponentName", "opponentTeamId", "startsAt", "location", "notes",
  "status", "cancelledAt", "cancelledReason", "report", "isLive", "livePrimaryAction",
].sort();

for (const { name, mod } of FIXTURES) {
  const { fixture, rawRecordsForHash } = mod;
  const { event, squads, matches, liveSessions, now, identity } = fixture;
  const project = () => buildEventDayProjection({ event, squads, matches, now });

  describe(`E02 ${name} fixture integrity`, () => {
    it("fixtureSha256 matches an independent recomputation from the raw records", () => {
      const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
      expect(identity.fixtureSha256).toBe(recomputed);
      expect(identity.fixedDateTimeUtc).toBe(now.toISOString());
      expect(identity.viewerTimeZone).toBe("Europe/Oslo");
      expect(identity.sourceClass).toBe("SYNTHETIC_LABELED");
    });

    it("1. every match belongs to the parent Event", () => {
      for (const m of matches) expect(m.eventId).toBe(event.id);
    });

    it("2. every eventSquadId resolves to a participating squad of this Event", () => {
      for (const s of squads) expect(s.eventId).toBe(event.id);
      const ids = new Set(squads.map((s) => s.id));
      for (const m of matches) expect(ids.has(m.eventSquadId)).toBe(true);
      expect(squads.length).toBeGreaterThanOrEqual(2);
      for (const s of squads) expect(matches.some((m) => m.eventSquadId === s.id)).toBe(true);
    });

    it("3. match ids are unique", () => {
      expect(new Set(matches.map((m) => m.id)).size).toBe(matches.length);
    });

    it("4. squad ids (and squad names) are distinct", () => {
      expect(new Set(squads.map((s) => s.id)).size).toBe(squads.length);
      expect(new Set(squads.map((s) => s.name)).size).toBe(squads.length);
    });

    it("5. timeline order follows kickoff timestamps, ties broken by the Event's squad order", () => {
      const items = project().items;
      const squadIndex = new Map(squads.map((s, i) => [s.id, i]));
      for (let i = 1; i < items.length; i++) {
        const a = items[i - 1].match;
        const b = items[i].match;
        expect(a.startsAt.getTime()).toBeLessThanOrEqual(b.startsAt.getTime());
        if (a.startsAt.getTime() === b.startsAt.getTime()) {
          expect(squadIndex.get(a.eventSquadId)!).toBeLessThanOrEqual(squadIndex.get(b.eventSquadId)!);
        }
      }
    });

    it("6. displayed kickoff times/dates match the records (Europe/Oslo)", () => {
      for (const m of matches) {
        // Guard for the independent +1h computation: the whole fixture sits before DST (28 Mar 2027).
        expect(m.startsAt.getTime()).toBeLessThan(new Date("2027-03-28T01:00:00Z").getTime());
      }
      for (const item of project().items) {
        expect(item.timeLabel).toBe(independentOsloHHMM(item.match.startsAt));
        expect(item.presentation.kickoffTime).toBe(item.timeLabel);
        expect(item.presentation.kickoffDate).toBe("SAT 13 MAR");
      }
    });

    it("7. match dates are consistent with Event timing", () => {
      for (const m of matches) {
        expect(m.startsAt.getTime()).toBeGreaterThanOrEqual(event.startsAt.getTime());
        if (event.endsAt) expect(m.startsAt.getTime()).toBeLessThanOrEqual(event.endsAt.getTime());
      }
      expect(new Set(project().items.map((i) => i.dayKey))).toEqual(new Set(["2027-03-13"]));
    });

    it("8. cancelled matches carry no result and render none", () => {
      for (const item of project().items.filter((i) => i.match.status === "CANCELLED")) {
        expect(item.match.report).toBeNull();
        expect(item.match.cancelledReason).toBeTruthy();
        expect(item.presentation.score).toBeNull();
        expect(item.presentation.outcomeLabel).toBeNull();
        expect(item.isNext).toBe(false);
        expect(item.lifecycle).toBe("cancelled");
      }
    });

    it("9. matches without a report never show a score", () => {
      for (const item of project().items.filter((i) => i.match.report === null)) {
        expect(item.presentation.score).toBeNull();
        expect(item.presentation.outcomeLabel).toBeNull();
      }
    });

    it("10. recorded results (LOCKED/REPORTED) agree with the displayed score and outcome", () => {
      for (const item of project().items.filter((i) => i.match.report?.status === "LOCKED" || i.match.report?.status === "REPORTED")) {
        const { ourScore, opponentScore } = item.match.report!;
        expect(item.presentation.score).toEqual({ home: ourScore, away: opponentScore });
        const expected = ourScore! > opponentScore! ? "WON" : ourScore! < opponentScore! ? "LOST" : "DRAW";
        expect(item.presentation.outcomeLabel).toBe(expected);
        expect(item.presentation.homeTeam).toBe(squads.find((s) => s.id === item.match.eventSquadId)!.name);
      }
    });

    it("11. live state requires canonical ACTIVE-session evidence, never the clock alone", () => {
      for (const item of project().items) {
        const session = liveSessions.find((s) => s.eventMatchId === item.match.id);
        expect(item.match.isLive).toBe(session?.status === "ACTIVE");
        expect(item.lifecycle === "live").toBe(item.match.isLive && item.match.status !== "CANCELLED");
        if (!item.match.isLive) expect(item.match.livePrimaryAction).toBeNull();
      }
      // A match whose kickoff has passed but has no session is never live.
      for (const item of project().items.filter((i) => i.match.startsAt <= now && !i.match.isLive)) {
        expect(item.lifecycle).not.toBe("live");
      }
    });

    it("12. NEXT is exactly the earliest genuine upcoming kickoff(s)", () => {
      const eligible = matches.filter((m) => m.status !== "CANCELLED" && !m.report && !m.isLive && m.startsAt > now);
      const earliest = Math.min(...eligible.map((m) => m.startsAt.getTime()));
      const expected = eligible.filter((m) => m.startsAt.getTime() === earliest).map((m) => m.id).sort();
      expect([...project().nextMatchIds].sort()).toEqual(expected);
      for (const item of project().items) expect(item.kicker === "NEXT").toBe(expected.includes(item.match.id));
    });

    it("13. simultaneous matches stay individually identifiable", () => {
      const byKickoff = new Map<number, typeof matches>();
      for (const m of matches) byKickoff.set(m.startsAt.getTime(), [...(byKickoff.get(m.startsAt.getTime()) ?? []), m]);
      const groups = [...byKickoff.values()].filter((g) => g.length > 1);
      expect(groups.length).toBeGreaterThan(0);
      for (const g of groups) {
        expect(new Set(g.map((m) => `${m.eventSquadId}|${m.opponentName}`)).size).toBe(g.length);
        expect(new Set(g.map((m) => m.eventSquadId)).size).toBe(g.length);
      }
    });

    it("14. summary and per-squad counts reconcile to the records", () => {
      const p = project();
      const s = p.summary;
      expect(s.total).toBe(matches.length);
      expect(s.results + s.live + s.reportFollowUp + s.upcoming + s.cancelled).toBe(matches.length);
      expect(s.cancelled).toBe(matches.filter((m) => m.status === "CANCELLED").length);
      expect(s.results).toBe(matches.filter((m) => m.status !== "CANCELLED" && !m.isLive && (m.report?.status === "LOCKED" || m.report?.status === "REPORTED")).length);
      expect(s.lockedResults + s.reportedNotLocked).toBe(s.results);
      expect(p.squadProgress.reduce((n, sp) => n + sp.total, 0)).toBe(matches.length);
      for (const sp of p.squadProgress) {
        expect(sp.total).toBe(matches.filter((m) => m.eventSquadId === sp.squad.id).length);
        expect(sp.results + sp.live + sp.reportFollowUp + sp.upcoming + sp.cancelled).toBe(sp.total);
      }
    });

    it("15. no event-day item exists that is not a real match record (no agenda/venue/meeting items)", () => {
      expect(project().items.map((i) => i.match.id)).toEqual(expect.arrayContaining(matches.map((m) => m.id)));
      expect(project().items.length).toBe(matches.length);
      expect(Object.keys(event).sort()).toEqual(ALLOWED_EVENT_KEYS);
      for (const m of matches) {
        expect(Object.keys(m).sort()).toEqual(ALLOWED_MATCH_KEYS);
        expect(m.location).toBeNull();
      }
    });

    it("16. unknown data never silently becomes zero", () => {
      for (const item of project().items) {
        const r = item.match.report;
        if (!r || r.ourScore == null || r.opponentScore == null || item.lifecycle !== "done") {
          expect(item.presentation.score).toBeNull();
        }
        expect(item.presentation.clockLabel).toBeNull();
        expect(item.match.opponentTeamId).toBeNull();
      }
    });

    it("17. Event finalisation never rewrites match lifecycle or report facts", () => {
      const asIs = project().items.map((i) => [i.match.id, i.lifecycle, i.reportState, i.kicker]);
      for (const status of ["DRAFT", "FINALIZED"] as const) {
        const flipped = buildEventDayProjection({ event: { ...event, status }, squads, matches, now });
        expect(flipped.items.map((i) => [i.match.id, i.lifecycle, i.reportState, i.kicker])).toEqual(asIs);
      }
    });
  });
}

describe("E02 cross-fixture identity", () => {
  it("no match, squad or event id is reused between child candidates", () => {
    const all = FIXTURES.flatMap(({ mod }) => [mod.fixture.event.id, ...mod.fixture.squads.map((s) => s.id), ...mod.fixture.matches.map((m) => m.id)]);
    expect(new Set(all).size).toBe(all.length);
  });
});
