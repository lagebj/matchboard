import { describe, it, expect } from "vitest";
import * as upcoming from "../upcoming/fixtures";
import * as mixed from "../mixed-progression/fixtures";
import * as completed from "../completed/fixtures";
import { buildEventDayProjection, describeSummary } from "../shared/event-day-projection";
import type { E02EventDayFixture } from "../shared/event-day-fixture-types";
import { osloOn } from "../shared/fixture-builders";
import { matchId } from "../shared/event-day-schedule";

function project(f: E02EventDayFixture, selectedMatchId?: string | null, now = f.now) {
  return buildEventDayProjection({ event: f.event, squads: f.squads, matches: f.matches, now, selectedMatchId });
}
const byId = (p: ReturnType<typeof project>, n: string) => p.items.find((i) => i.match.id === matchId(n))!;

describe("GATE-E-W2-E02-MIXED projection", () => {
  const p = project(mixed.fixture);

  it("orders nine matches by kickoff, simultaneous kickoffs by the Event's squad order", () => {
    expect(p.items.map((i) => i.match.id)).toEqual(["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09"].map(matchId));
    expect(p.items.map((i) => i.timeLabel)).toEqual(["09:00", "09:00", "09:40", "10:20", "10:20", "11:20", "12:40", "12:40", "14:00"]);
  });

  it("distinguishes every lifecycle with text, not colour alone", () => {
    expect(p.items.map((i) => i.kicker)).toEqual([
      null, null, "CANCELLED", "REPORT MISSING", "REPORT DRAFT", "LIVE", "NEXT", "NEXT", "LATER",
    ]);
    expect(p.items.map((i) => i.lifecycle)).toEqual([
      "done", "done", "cancelled", "played", "report_incomplete", "live", "planning_open", "planning_open", "planning_open",
    ]);
  });

  it("the two 12:40 matches (one per squad) are both NEXT; the cancelled 09:40 match never is", () => {
    expect(p.nextMatchIds).toEqual([matchId("m07"), matchId("m08")]);
    expect(byId(p, "m03").isNext).toBe(false);
  });

  it("a DRAFT report's score is never presented as a result", () => {
    const draft = byId(p, "m05");
    expect(draft.match.report).toMatchObject({ status: "DRAFT", ourScore: 1, opponentScore: 0 });
    expect(draft.presentation.score).toBeNull();
    expect(draft.presentation.outcomeLabel).toBeNull();
    expect(draft.presentation.reportAttention?.label).toBe("Report draft");
  });

  it("the live match is live only from its canonical session, with no invented clock or score", () => {
    const live = byId(p, "m06");
    expect(live.match.isLive).toBe(true);
    expect(live.match.livePrimaryAction).toEqual({ kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" });
    expect(live.presentation.lifecycle).toBe("live");
    expect(live.presentation.clockLabel).toBeNull();
    expect(live.presentation.score).toBeNull();
  });

  it("a kicked-off match without a report is report follow-up, never a result and never live", () => {
    const played = byId(p, "m04");
    expect(played.lifecycle).toBe("played");
    expect(played.presentation.score).toBeNull();
    expect(played.presentation.reportAttention?.label).toBe("Report missing");
  });

  it("summary reconciles: what happened, what needs attention, what comes next", () => {
    expect(p.summary).toEqual({ total: 9, results: 2, lockedResults: 2, reportedNotLocked: 0, live: 1, reportFollowUp: 2, upcoming: 3, cancelled: 1 });
    expect(describeSummary(p.summary)).toBe("2 results · 1 live · 2 need report follow-up · 3 to come · 1 cancelled");
  });

  it("per-squad progression keeps each squad's own matches", () => {
    const [bla, rod] = p.squadProgress;
    expect(bla).toMatchObject({ total: 4, results: 1, live: 1, reportFollowUp: 1, upcoming: 1, cancelled: 0, nextKickoffLabel: "12:40" });
    expect(rod).toMatchObject({ total: 5, results: 1, live: 0, reportFollowUp: 1, upcoming: 2, cancelled: 1, nextKickoffLabel: "12:40" });
  });

  it("same opponent across squads and within one squad stays three distinct match identities", () => {
    const nordbyen = p.items.filter((i) => i.match.opponentName === "Nordbyen FK");
    expect(nordbyen.map((i) => [i.match.id, i.squad?.name, i.timeLabel])).toEqual([
      [matchId("m01"), "Fjellsiden Blå", "09:00"],
      [matchId("m05"), "Fjellsiden Rød", "10:20"],
      [matchId("m09"), "Fjellsiden Rød", "14:00"],
    ]);
  });

  it("selecting a Rød match resolves exactly that match and squad, never Blå's", () => {
    const sel = project(mixed.fixture, matchId("m05")).selected!;
    expect(sel.match.id).toBe(matchId("m05"));
    expect(sel.squad?.name).toBe("Fjellsiden Rød");
    expect(sel.presentation.homeTeam).toBe("Fjellsiden Rød");
  });

  it("a match id that is not a match of this Event is rejected, never re-parented", () => {
    const foreign = project(mixed.fixture, "gate-e-w2-e02-other-event-m01");
    expect(foreign.selected).toBeNull();
    expect(foreign.rejectedSelectionId).toBe("gate-e-w2-e02-other-event-m01");
  });

  it("a record carrying another eventId is excluded from this Event's day", () => {
    const stray = { ...mixed.fixture.matches[0], id: "gate-e-w2-e02-stray", eventId: "gate-e-w2-e02-other-event" };
    const withStray = buildEventDayProjection({ ...mixed.fixture, matches: [...mixed.fixture.matches, stray] });
    expect(withStray.items.length).toBe(mixed.fixture.matches.length);
    expect(withStray.items.some((i) => i.match.id === stray.id)).toBe(false);
  });

  it("order is deterministic regardless of input order", () => {
    const reversed = buildEventDayProjection({ ...mixed.fixture, matches: [...mixed.fixture.matches].reverse() });
    expect(reversed.items.map((i) => i.match.id)).toEqual(p.items.map((i) => i.match.id));
  });
});

describe("GATE-E-W2-E02-UPCOMING projection", () => {
  const p = project(upcoming.fixture);

  it("both 09:00 matches are NEXT, everything else LATER, no scores anywhere", () => {
    expect(p.nextMatchIds).toEqual([matchId("m01"), matchId("m02")]);
    expect(p.items.map((i) => i.kicker)).toEqual(["NEXT", "NEXT", "LATER", "LATER", "LATER", "LATER", "LATER", "LATER", "LATER"]);
    for (const i of p.items) expect(i.presentation.score).toBeNull();
    expect(p.summary).toMatchObject({ total: 9, upcoming: 9, results: 0, live: 0, reportFollowUp: 0, cancelled: 0 });
  });

  it("classification is driven only by the supplied reference instant", () => {
    const later = project(upcoming.fixture, null, osloOn("2027-03-13", "09:10"));
    expect(byId(later, "m01").lifecycle).toBe("played");
    expect(later.nextMatchIds).toEqual([matchId("m03")]);
  });
});

describe("GATE-E-W2-E02-COMPLETED projection", () => {
  const p = project(completed.fixture);

  it("eight recorded results and one cancelled match; no NEXT, no LIVE, no follow-up", () => {
    expect(p.nextMatchIds).toEqual([]);
    expect(p.items.filter((i) => i.lifecycle !== "cancelled").every((i) => i.lifecycle === "done")).toBe(true);
    expect(p.items.map((i) => i.kicker).filter(Boolean)).toEqual(["CANCELLED"]);
    expect(p.summary).toMatchObject({ total: 9, results: 8, lockedResults: 7, reportedNotLocked: 1, live: 0, reportFollowUp: 0, upcoming: 0, cancelled: 1 });
  });

  it("the REPORTED (not locked) result is distinguishable from LOCKED ones", () => {
    const reported = byId(p, "m07");
    expect(reported.reportState).toBe("REPORTED");
    expect(reported.caption).toBe("Result reported · report not locked");
    expect(reported.presentation.score).toEqual({ home: 1, away: 1 });
  });

  it("the final result of the 10:20 Rød match is its LOCKED score, not the earlier draft", () => {
    expect(byId(p, "m05").presentation.score).toEqual({ home: 2, away: 0 });
  });
});
