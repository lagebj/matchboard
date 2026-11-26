import { describe, it, expect } from "vitest";
import type { EvidenceRef } from "@/lib/development-context/types";
import { resolveEvidenceSource, resolveEvidenceSources, type EvidenceSourceMap } from "../evidence-source-types";

const SOURCES: EvidenceSourceMap = {
  "trend-1": {
    id: "trend-1",
    kind: "DERIVED_TREND",
    label: "Defensive-third giveaway rate",
    provenance: "DERIVED",
    detail: "5 across 3 matches -> 2 across 3 matches.",
    coverage: "6 of 6 eligible matches",
  },
  "obs-1": {
    id: "obs-1",
    kind: "QUALITATIVE_OBSERVATION",
    label: "Coach observation, 11 Oct 2026",
    provenance: "RECORDED",
    detail: "Comfortable receiving under pressure twice.",
    coverage: "Single observation",
  },
};

describe("resolveEvidenceSource", () => {
  it("resolves a ref to its matching fixture source record", () => {
    const ref: EvidenceRef = { kind: "DERIVED_TREND", id: "trend-1", label: "Defensive-third giveaway rate" };
    expect(resolveEvidenceSource(ref, SOURCES)).toBe(SOURCES["trend-1"]);
  });

  it("throws when no source record is registered for the ref id — a fixture must never cite a label with nothing behind it", () => {
    const ref: EvidenceRef = { kind: "DERIVED_TREND", id: "missing-id" };
    expect(() => resolveEvidenceSource(ref, SOURCES)).toThrow(/no source record registered/);
  });

  it("throws when the source record's kind does not match the ref's declared kind", () => {
    const ref: EvidenceRef = { kind: "MATCH_EVENT", id: "trend-1" };
    expect(() => resolveEvidenceSource(ref, SOURCES)).toThrow(/declares kind "MATCH_EVENT" but its source record is "DERIVED_TREND"/);
  });
});

describe("resolveEvidenceSources", () => {
  it("resolves a list of refs in order, preserving duplicates", () => {
    const refs: EvidenceRef[] = [
      { kind: "DERIVED_TREND", id: "trend-1" },
      { kind: "QUALITATIVE_OBSERVATION", id: "obs-1" },
    ];
    expect(resolveEvidenceSources(refs, SOURCES)).toEqual([SOURCES["trend-1"], SOURCES["obs-1"]]);
  });

  it("returns an empty array for an empty ref list rather than throwing", () => {
    expect(resolveEvidenceSources([], SOURCES)).toEqual([]);
  });
});
