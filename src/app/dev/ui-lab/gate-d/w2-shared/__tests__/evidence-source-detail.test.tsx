import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { EvidenceRef } from "@/lib/development-context/types";
import { EvidenceSourceInspector } from "../evidence-source-detail";
import type { EvidenceSourceMap } from "../evidence-source-types";

/**
 * Remediation (owner review of PR #847, finding P1 #2): the source-inspector pill label was
 * previously derived from `FixtureSourceProvenance` (RECORDED/DERIVED), which mislabels a
 * `HUMAN_ASSESSMENT` or `QUALITATIVE_OBSERVATION` as a "Recorded fact" — both are `provenance:
 * "RECORDED"` but are a coach's own judgment, not an objective fact. These tests exhaustively
 * cover every `EvidenceRef.kind` the real domain defines, exactly so this class of mislabeling
 * cannot silently recur for a kind this suite doesn't check.
 */
const ALL_KINDS: EvidenceRef["kind"][] = [
  "MATCH_EVENT",
  "ACTUAL_POSITION_INTERVAL",
  "QUALITATIVE_OBSERVATION",
  "HUMAN_ASSESSMENT",
  "MATCH_CONTEXT",
  "DERIVED_MEASUREMENT",
  "DERIVED_TREND",
];

const EXPECTED_LABEL: Record<EvidenceRef["kind"], string> = {
  MATCH_EVENT: "Recorded match event",
  ACTUAL_POSITION_INTERVAL: "Recorded position",
  QUALITATIVE_OBSERVATION: "Coach observation",
  HUMAN_ASSESSMENT: "Coach assessment",
  MATCH_CONTEXT: "Recorded match context",
  DERIVED_MEASUREMENT: "Derived measurement",
  DERIVED_TREND: "Derived trend",
};

function sourcesFor(kind: EvidenceRef["kind"]): { refs: EvidenceRef[]; sources: EvidenceSourceMap } {
  const id = `test-source-${kind.toLowerCase()}`;
  return {
    refs: [{ kind, id, label: `Test source for ${kind}` }],
    sources: {
      [id]: {
        id,
        kind,
        label: `Test source for ${kind}`,
        detail: `Detail text for ${kind}.`,
        provenance: kind === "DERIVED_MEASUREMENT" || kind === "DERIVED_TREND" ? "DERIVED" : "RECORDED",
        coverage: "Test coverage",
      },
    },
  };
}

describe("EvidenceSourceInspector — exhaustive source-kind classification", () => {
  it.each(ALL_KINDS)("labels kind %s correctly", (kind) => {
    const { refs, sources } = sourcesFor(kind);
    render(<EvidenceSourceInspector title="Test" refs={refs} sources={sources} />);
    expect(screen.getByText(EXPECTED_LABEL[kind])).toBeInTheDocument();
  });

  it("HUMAN_ASSESSMENT never receives the generic 'Recorded fact' label, despite RECORDED provenance", () => {
    const { refs, sources } = sourcesFor("HUMAN_ASSESSMENT");
    render(<EvidenceSourceInspector title="Test" refs={refs} sources={sources} />);
    expect(screen.getByText("Coach assessment")).toBeInTheDocument();
    expect(screen.queryByText("Recorded fact")).not.toBeInTheDocument();
  });

  it("QUALITATIVE_OBSERVATION is never displayed as an objective performance measurement", () => {
    const { refs, sources } = sourcesFor("QUALITATIVE_OBSERVATION");
    render(<EvidenceSourceInspector title="Test" refs={refs} sources={sources} />);
    expect(screen.getByText("Coach observation")).toBeInTheDocument();
    expect(screen.queryByText("Recorded fact")).not.toBeInTheDocument();
    expect(screen.queryByText("Derived measurement")).not.toBeInTheDocument();
  });

  it("ACTUAL_POSITION_INTERVAL retains exact tactical-position information in its own detail text", () => {
    const refs: EvidenceRef[] = [{ kind: "ACTUAL_POSITION_INTERVAL", id: "interval-x" }];
    const sources: EvidenceSourceMap = {
      "interval-x": {
        id: "interval-x",
        kind: "ACTUAL_POSITION_INTERVAL",
        label: "Recorded position, 1 Jan 2026 (Left Centre Back)",
        detail: "Played the full 90 minutes at Left Centre Back (exact tactical code: LCB) vs Example.",
        provenance: "RECORDED",
        coverage: "Single match, full-match interval",
      },
    };
    render(<EvidenceSourceInspector title="Test" refs={refs} sources={sources} />);
    expect(screen.getByText("Recorded position")).toBeInTheDocument();
    expect(screen.getByText(/exact tactical code: LCB/)).toBeInTheDocument();
  });

  it("DERIVED_TREND remains visually and textually distinct from the underlying observations it's derived from", () => {
    const refs: EvidenceRef[] = [
      { kind: "DERIVED_TREND", id: "trend-x" },
      { kind: "QUALITATIVE_OBSERVATION", id: "obs-x" },
    ];
    const sources: EvidenceSourceMap = {
      "trend-x": {
        id: "trend-x",
        kind: "DERIVED_TREND",
        label: "Trend X",
        detail: "Trend detail.",
        provenance: "DERIVED",
        coverage: "6 of 6 eligible matches",
      },
      "obs-x": {
        id: "obs-x",
        kind: "QUALITATIVE_OBSERVATION",
        label: "Observation X",
        detail: "Observation detail.",
        provenance: "RECORDED",
        coverage: "Single match observation",
      },
    };
    render(<EvidenceSourceInspector title="Test" refs={refs} sources={sources} />);
    expect(screen.getByText("Derived trend")).toBeInTheDocument();
    expect(screen.getByText("Coach observation")).toBeInTheDocument();
  });

  it("source inspection stays keyboard-accessible via native <details>/<summary>, unaffected by the label change", () => {
    const { refs, sources } = sourcesFor("DERIVED_MEASUREMENT");
    const { container } = render(<EvidenceSourceInspector title="Test" refs={refs} sources={sources} />);
    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    expect(details).not.toBeNull();
    expect(summary).not.toBeNull();
    expect(summary?.tagName).toBe("SUMMARY");
  });
});
