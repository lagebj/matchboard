import { describe, it, expect } from "vitest";
import * as upcoming from "../upcoming/fixtures";
import * as mixed from "../mixed-progression/fixtures";
import * as completed from "../completed/fixtures";
import { buildEventDayProjection, describeSummary } from "../shared/event-day-projection";
import type { E02EventDayFixture } from "../shared/event-day-fixture-types";
import { osloOn } from "../shared/fixture-builders";

function project(f: E02EventDayFixture, selectedMatchId?: string | null, now = f.now) {
  return buildEventDayProjection({ event: f.event, squads: f.squads, matches: f.matches, now, selectedMatchId });
}
const byId = (p: ReturnType<typeof project>, id: string) => p.items.find((i) => i.match.id === id)!;

describe("GATE-E-W2-E02-MIXED projection", () => {
  const p = project(mixed.fixture);

  it("orders nine matches by kickoff, simultaneous kickoffs by the Event's squad order", () => {
    expect(p.items.map((i) => i.match.id.replace("gate-e-w2-e02-mixed-", ""))).toEqual([
      "m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09",
    ]);
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
    expect(p.nextMatchIds).toEqual(["gate-e-w2-e02-mixed-m07", "gate-e-w2-e02-mixed-m08"]);
    expect(byId(p, "gate-e-w2-e02-mixed-m03").isNext).toBe(false);
  });

  it("a DRAFT report's score is never presented as a result", () => {
    const draft = byId(p, "gate-e-w2-e02-mixed-m05");
    expect(draft.match.report).toMatchObject({ status: "DRAFT", ourScore: 1, opponentScore: 0 });
    expect(draft.presentation.score).toBeNull();
    expect(draft.presentation.outcomeLabel).toBeNull();
    expect(draft.presentation.reportAttention?.label).toBe("Report draft");
  });

  it("the live match is live only from its canonical session, with no invented clock or score", () => {
    const live = byId(p, "gate-e-w2-e02-mixed-m06");
    expect(live.match.isLive).toBe(true);
    expect(live.match.livePrimaryAction).toEqual({ kind: "END_PERIOD", period: "FIRST_HALF", label: "End first half" });
    expect(live.presentation.lifecycle).toBe("live");
    expect(live.presentation.clockLabel).toBeNull();
    expect(live.presentation.score).toBeNull();
  });

  it("a kicked-off match without a report is report follow-up, never a result and never live", () => {
    const played = byId(p, "gate-e-w2-e02-mixed-m04");
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
      ["gate-e-w2-e02-mixed-m01", "Fjellsiden Blå", "09:00"],
      ["gate-e-w2-e02-mixed-m05", "Fjellsiden Rød", "10:20"],
      ["gate-e-w2-e02-mixed-m09", "Fjellsiden Rød", "14:00"],
    ]);
  });

  it("selecting a Rød match resolves exactly that match and squad, never Blå's", () => {
    const sel = project(mixed.fixture, "gate-e-w2-e02-mixed-m05").selected!;
    expect(sel.match.id).toBe("gate-e-w2-e02-mixed-m05");
    expect(sel.squad?.name).toBe("Fjellsiden Rød");
    expect(sel.presentation.homeTeam).toBe("Fjellsiden Rød");
  });

  it("a match id from another Event is rejected, never re-parented under this Event", () => {
    const foreign = project(mixed.fixture, "gate-e-w2-e02-completed-m01");
    expect(foreign.selected).toBeNull();
    expect(foreign.rejectedSelectionId).toBe("gate-e-w2-e02-completed-m01");
  });

  it("a record carrying another eventId is excluded from this Event's day", () => {
    const stray = { ...completed.fixture.matches[0] };
    const withStray = buildEventDayProjection({ ...mixed.fixture, matches: [...mixed.fixture.matches, stray] });
    expect(withStray.items.length).toBe(mixed.fixture.matches.length);
  });

  it("order is deterministic regardless of input order", () => {
    const reversed = buildEventDayProjection({ ...mixed.fixture, matches: [...mixed.fixture.matches].reverse() });
    expect(reversed.items.map((i) => i.match.id)).toEqual(p.items.map((i) => i.match.id));
  });
});

describe("GATE-E-W2-E02-UPCOMING projection", () => {
  const p = project(upcoming.fixture);

  it("one genuine NEXT match, everything else LATER, no scores anywhere", () => {
    expect(p.nextMatchIds).toEqual(["gate-e-w2-e02-upcoming-m01"]);
    expect(p.items.map((i) => i.kicker)).toEqual(["NEXT", "LATER", "LATER", "LATER", "LATER", "LATER"]);
    for (const i of p.items) expect(i.presentation.score).toBeNull();
    expect(p.summary).toMatchObject({ total: 6, upcoming: 6, results: 0, live: 0, reportFollowUp: 0, cancelled: 0 });
  });

  it("classification is driven only by the supplied reference instant", () => {
    const later = project(upcoming.fixture, null, osloOn("2027-03-13", "09:10"));
    expect(byId(later, "gate-e-w2-e02-upcoming-m01").lifecycle).toBe("played");
    expect(later.nextMatchIds).toEqual(["gate-e-w2-e02-upcoming-m02"]);
  });
});

describe("GATE-E-W2-E02-COMPLETED projection", () => {
  const p = project(completed.fixture);

  it("every match has a recorded result; no NEXT, no LIVE, no follow-up", () => {
    expect(p.nextMatchIds).toEqual([]);
    expect(p.items.every((i) => i.lifecycle === "done")).toBe(true);
    expect(p.items.some((i) => i.kicker !== null)).toBe(false);
    expect(p.summary).toMatchObject({ total: 6, results: 6, lockedResults: 5, reportedNotLocked: 1, live: 0, reportFollowUp: 0, upcoming: 0 });
  });

  it("the REPORTED (not locked) result is distinguishable from LOCKED ones", () => {
    const reported = byId(p, "gate-e-w2-e02-completed-m05");
    expect(reported.reportState).toBe("REPORTED");
    expect(reported.caption).toBe("Result reported · report not locked");
    expect(reported.presentation.score).toEqual({ home: 1, away: 1 });
  });
});
