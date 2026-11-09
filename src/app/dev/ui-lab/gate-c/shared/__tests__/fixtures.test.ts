import { describe, it, expect } from "vitest";
import { getDisplayDateKey } from "@/lib/date-utils";
import { resolveTodayMatchdayPhase } from "@/lib/touchline/presentation/today-matchday-phase";
import {
  GATE_C_NOW_ISO,
  gateCBuildBusyDay,
  type GateCMatchdayPhase,
} from "../fixtures";

/**
 * P2-01 remediation (independent review of PR #826): every Gate C fixture now derives from one
 * fixed reference instant (`GATE_C_NOW_ISO`), not the real `Date.now()`. These tests prove exact
 * fixture phase selection and date eligibility independently of the developer machine's current
 * time — the exact property the review's acceptance tests ask for.
 */

const PHASES: GateCMatchdayPhase[] = ["PREPARE", "VERIFY", "IMMINENT"];

describe("gateCBuildBusyDay — real phase resolution, independent of the real clock", () => {
  for (const source of ["LEAGUE", "EVENT"] as const) {
    for (const phase of PHASES) {
      it(`${source} ${phase} genuinely resolves to ${phase} via the real resolveTodayMatchdayPhase()`, () => {
        const { matchdayContext, nowIso } = gateCBuildBusyDay({ source, phase });
        const resolved = resolveTodayMatchdayPhase({
          nowIso,
          startsAtIso: matchdayContext!.featured.startsAt,
          lifecycleStatus: matchdayContext!.featured.lifecycleStatus,
          hasActiveLiveSession: matchdayContext!.featured.hasActiveLiveSession,
          canEnterLiveReporting: matchdayContext!.featured.liveEntryHref != null,
        });
        expect(resolved.phase).toBe(phase);
      });
    }
  }

  it("is fully deterministic — two calls with the same params produce identical output", () => {
    const first = gateCBuildBusyDay({ source: "LEAGUE", phase: "VERIFY" });
    const second = gateCBuildBusyDay({ source: "LEAGUE", phase: "VERIFY" });
    expect(first.nowIso).toBe(second.nowIso);
    expect(first.matchdayContext!.featured.startsAt).toBe(second.matchdayContext!.featured.startsAt);
    expect(first.matchdayContext!.featured.id).toBe(second.matchdayContext!.featured.id);
  });

  it("every same-day candidate match falls on the real Europe/Oslo calendar day as GATE_C_NOW_ISO", () => {
    const { todayMatches } = gateCBuildBusyDay({ source: "LEAGUE", phase: "IMMINENT" });
    const nowDateKey = getDisplayDateKey(new Date(GATE_C_NOW_ISO));
    for (const match of todayMatches) {
      expect(getDisplayDateKey(new Date(match.startsAt!))).toBe(nowDateKey);
    }
  });

  it("the real selector picks the intended featured match out of a genuinely busy day, not the earlier or later one", () => {
    const { matchdayContext, todayMatches } = gateCBuildBusyDay({ source: "LEAGUE", phase: "PREPARE" });
    const earlier = todayMatches.find((m) => m.matchId === "match-c03-earlier")!;
    const later = todayMatches.find((m) => m.matchId === "match-c03-later")!;
    expect(matchdayContext!.featured.id).not.toBe(earlier.matchId);
    expect(matchdayContext!.featured.id).not.toBe(later.matchId);
    expect(matchdayContext!.featured.id).toBe("match-c03-featured");
  });
});
