/**
 * Shared decision/evidence contract (ADR-0157 §4, `03_SHARED_DECISION_EVIDENCE_CONTRACT.md`).
 * Pure types and normalization helpers only — no React, no Prisma, no I/O. This payload is
 * presentation metadata attached to an existing `CoachDecisionCandidate`/`CoachDecision`; it is
 * never sent to the situation policy as ranking input and never creates a second relevance/
 * priority score. Today/Match Preparation/Round Board/Player Detail/Completed Match/Season
 * Review all reuse these same five vocabularies rather than inventing their own.
 */

/** Evidence-sufficiency maturity. Reuse an existing domain's own threshold when adapting its
 * output (e.g. `ConfidenceLevel`/`TeamSeasonProfile`'s `INSUFFICIENT|EMERGING|ESTABLISHED`,
 * `match-phase-pattern-evidence.ts`'s `classifyMatchPhaseConfidence`,
 * `combination-topology.ts`'s `deriveConfidence`) — never a new numeric threshold. */
export type DecisionEvidenceMaturity = "NONE" | "EMERGING" | "ESTABLISHED" | "NOT_APPLICABLE";

/** How complete the inputs behind the evidence are. For an ADR-0155 `DerivedMeasurement`/
 * `DerivedTrend`, map its own `MeasurementCoverage` (`src/lib/development-context/types.ts`)
 * directly via `fromMeasurementCoverage()` below — never recompute coverage independently. */
export type DecisionEvidenceCoverage = "COMPLETE" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE";

/** Existing AI source-fingerprint logic remains the authority for AI freshness; this is the
 * shared vocabulary a provider maps that (or a non-AI recency fact) into. */
export type DecisionEvidenceFreshness = "CURRENT" | "AGING" | "STALE" | "NOT_APPLICABLE";

/** Domain evidence change state must come from canonical revisions/trends. Today's own
 * browser-local "since last visit" mechanism may use this for presentation-only comparison;
 * it must never become the canonical source for a non-Today surface. */
export type DecisionEvidenceChangeState = "NEW" | "CHANGED" | "UNCHANGED" | "RESOLVED" | "NOT_APPLICABLE";

/** Coarser, UI-facing provenance category spanning the whole app — distinct from (and often
 * wrapping) ADR-0155's own narrower `EvidenceRef.kind` (`MATCH_EVENT`,
 * `ACTUAL_POSITION_INTERVAL`, ...), which stays the precise internal pointer for one derived
 * measurement's own inputs. */
export type DecisionEvidenceSourceKind =
  | "MATCH_DATA"
  | "PLAN_INTEGRITY"
  | "POSITION_EVIDENCE"
  | "DEVELOPMENT_CONTEXT"
  | "COACH_OBSERVATION"
  | "OPPONENT_MEMORY"
  | "PREVIOUS_ASSISTANT_EXPECTATION"
  | "ASSISTANT_HYPOTHESIS";

export type DecisionEvidenceSource = {
  kind: DecisionEvidenceSourceKind;
  /** Stable local ref/deep link where one exists. Never a player/team name — names are
   * presentation data resolved by the caller, not a stored reasoning identifier. */
  ref: string;
  label?: string;
  observedAt?: string;
  deepLink?: string;
};

export type DecisionEvidenceSupport = {
  /** Deterministic coach-facing sentence. AI text does not belong here. */
  summary?: string;
  maturity: DecisionEvidenceMaturity;
  coverage: DecisionEvidenceCoverage;
  freshness: DecisionEvidenceFreshness;
  changeState: DecisionEvidenceChangeState;
  sources: DecisionEvidenceSource[];
  caveats: string[];
};

/** Maps the repository's existing three-value confidence vocabulary (reused verbatim by
 * `match-phase-pattern-evidence.ts`, `combination-topology.ts`, and
 * `team-season-profile/contracts.ts`'s `ConfidenceLevel`) onto the shared maturity vocabulary.
 * `INSUFFICIENT` becomes `NONE` here because this contract's `NONE` means exactly that: not
 * enough sample for a pattern claim. */
export function fromConfidenceLevel(level: "INSUFFICIENT" | "EMERGING" | "ESTABLISHED"): DecisionEvidenceMaturity {
  if (level === "INSUFFICIENT") return "NONE";
  return level;
}

/** Maps ADR-0155's `MeasurementCoverage` (`src/lib/development-context/types.ts`) onto the
 * shared coverage vocabulary. A straight pass-through — `NOT_APPLICABLE` is only ever chosen
 * directly by a caller whose fact has no coverage concept at all (e.g. a plain operational
 * fact), never derived from a measurement. */
export function fromMeasurementCoverage(coverage: "COMPLETE" | "PARTIAL" | "UNKNOWN"): DecisionEvidenceCoverage {
  return coverage;
}
