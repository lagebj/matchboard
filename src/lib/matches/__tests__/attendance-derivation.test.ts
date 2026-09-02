import { describe, it, expect } from "vitest";
import { deriveInitialAttendance } from "../attendance-derivation";

describe("deriveInitialAttendance", () => {
  const makeAvail = (map: Record<string, string>) => new Map(Object.entries(map));
  const makeAbsence = (map: Record<string, string>) => new Map(Object.entries(map));

  it("returns PRESENT for AVAILABLE availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({ p1: "AVAILABLE" }), makeAbsence({}))).toBe("PRESENT");
  });

  it("returns PRESENT for TENTATIVE availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({ p1: "TENTATIVE" }), makeAbsence({}))).toBe("PRESENT");
  });

  it("returns NO_SHOW for UNAVAILABLE availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({ p1: "UNAVAILABLE" }), makeAbsence({}))).toBe("NO_SHOW");
  });

  it("returns NO_SHOW for INJURED availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({ p1: "INJURED" }), makeAbsence({}))).toBe("NO_SHOW");
  });

  it("returns NO_SHOW for SICK availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({ p1: "SICK" }), makeAbsence({}))).toBe("NO_SHOW");
  });

  it("returns NO_SHOW for AWAY availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({ p1: "AWAY" }), makeAbsence({}))).toBe("NO_SHOW");
  });

  it("returns UNKNOWN for unknown/unset availability", () => {
    expect(deriveInitialAttendance("p1", makeAvail({}), makeAbsence({}))).toBe("UNKNOWN");
  });

  it("returns NO_SHOW when match absence is recorded, regardless of availability", () => {
    expect(
      deriveInitialAttendance("p1", makeAvail({ p1: "AVAILABLE" }), makeAbsence({ p1: "NO_SHOW" })),
    ).toBe("NO_SHOW");
  });

  it("returns NO_SHOW when match absence overrides TENTATIVE availability", () => {
    expect(
      deriveInitialAttendance("p1", makeAvail({ p1: "TENTATIVE" }), makeAbsence({ p1: "SICK" })),
    ).toBe("NO_SHOW");
  });

  it("prioritises match absence over availability status", () => {
    expect(
      deriveInitialAttendance("p1", makeAvail({ p1: "AVAILABLE" }), makeAbsence({ p1: "INJURED" })),
    ).toBe("NO_SHOW");
  });

  it("does not treat another player's absence as this player's absence", () => {
    expect(
      deriveInitialAttendance("p1", makeAvail({ p1: "AVAILABLE" }), makeAbsence({ p2: "NO_SHOW" })),
    ).toBe("PRESENT");
  });

  it("does not treat another player's availability as this player's availability", () => {
    expect(
      deriveInitialAttendance("p1", makeAvail({ p2: "AVAILABLE" }), makeAbsence({})),
    ).toBe("UNKNOWN");
  });
});