import { describe, it, expect } from "vitest";
import { getRoundActions, getMatchActions, deriveMatchSelectionState } from "../selection-state-utils";

describe("getRoundActions", () => {
  it("returns empty array when round has no matches", () => {
    expect(getRoundActions("NOT_GENERATED", false)).toEqual([]);
  });

  it("returns createDraft for NOT_GENERATED rounds with matches", () => {
    expect(getRoundActions("NOT_GENERATED", true)).toEqual(["createDraft"]);
  });

  it("returns recreate, clear, finalize for DRAFT rounds", () => {
    const actions = getRoundActions("DRAFT", true);
    expect(actions).toContain("recreateDraft");
    expect(actions).toContain("clearDraft");
    expect(actions).toContain("finalize");
  });

  it("returns recreate, clear, finalize for BLOCKED rounds", () => {
    const actions = getRoundActions("BLOCKED", true);
    expect(actions).toContain("recreateDraft");
    expect(actions).toContain("clearDraft");
    expect(actions).toContain("finalize");
  });

  it("returns recreate, clear, finalize for READY rounds", () => {
    const actions = getRoundActions("READY", true);
    expect(actions).toContain("recreateDraft");
    expect(actions).toContain("clearDraft");
    expect(actions).toContain("finalize");
  });

  it("returns unfinalize for FINALIZED rounds", () => {
    expect(getRoundActions("FINALIZED", true)).toEqual(["unfinalize"]);
  });
});

describe("getMatchActions", () => {
  it("returns empty array when round is finalized", () => {
    expect(getMatchActions("FINALIZED", true, true)).toEqual([]);
  });

  it("returns createDraft for NOT_GENERATED round", () => {
    expect(getMatchActions("NOT_GENERATED", false, true)).toEqual(["createDraft"]);
  });

  it("returns recreate, clear, finalize for match with draft in draft round", () => {
    const actions = getMatchActions("DRAFT", true, true);
    expect(actions).toContain("recreateDraft");
    expect(actions).toContain("clearDraft");
    expect(actions).toContain("finalize");
  });

  it("returns createDraft for match without draft in draft round", () => {
    expect(getMatchActions("DRAFT", false, true)).toEqual(["createDraft"]);
  });

  it("returns recreate, clear, finalize for match in BLOCKED round", () => {
    const actions = getMatchActions("BLOCKED", true, true);
    expect(actions).toContain("recreateDraft");
    expect(actions).toContain("clearDraft");
    expect(actions).toContain("finalize");
  });

  it("returns recreate, clear, finalize for match in READY round", () => {
    const actions = getMatchActions("READY", true, true);
    expect(actions).toContain("recreateDraft");
    expect(actions).toContain("clearDraft");
    expect(actions).toContain("finalize");
  });
});

describe("deriveMatchSelectionState", () => {
  it("returns FINALIZED when round is FINALIZED", () => {
    expect(deriveMatchSelectionState("FINALIZED", false, false)).toBe("FINALIZED");
  });

  it("returns FINALIZED when match has finalized selections", () => {
    expect(deriveMatchSelectionState("DRAFT", false, true)).toBe("FINALIZED");
  });

  it("returns DRAFT when match has draft selections", () => {
    expect(deriveMatchSelectionState("DRAFT", true, false)).toBe("DRAFT");
  });

  it("returns NOT_GENERATED when match has no selections in draft round", () => {
    expect(deriveMatchSelectionState("DRAFT", false, false)).toBe("NOT_GENERATED");
  });

  it("returns NOT_GENERATED when round is NOT_GENERATED", () => {
    expect(deriveMatchSelectionState("NOT_GENERATED", false, false)).toBe("NOT_GENERATED");
  });
});