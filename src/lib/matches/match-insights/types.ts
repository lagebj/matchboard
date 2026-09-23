import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import type { ConfidenceLevel } from "@/lib/evidence/combination-topology";
import type { HelperProvenance, PlannedAbsenceReason } from "@/generated/prisma/client";

/**
 * Match Insight domain types (ADR-0149). These are the shapes shared by every builder module in
 * `src/lib/matches/match-insights/` — the deterministic Layer A that computes preparation facts
 * and baseline insights without AI. AI enrichment (Layer B, `src/lib/ai/context/match-prep.ts`)
 * is built on top of these same facts, not a separate partial re-derivation.
 *
 * Deliberately does not reuse the AI Advisor's ephemeral-ref (`P01`/`M01`) vocabulary — that
 * scheme exists to keep real identities out of third-party provider payloads
 * (`src/lib/ai/jobs/capability-handler.ts`). This domain layer is server-only and its consumers
 * (server components/actions, `match-prep.ts`) already hold real `playerId`s; ephemeral refs are
 * assigned only at the point a context actually gets sent to a provider.
 */

/** Semantic relevance class — never a synthesized numeric score (ADR-0149 Decision 2; bundle §5:
 * "not fake numeric precision"). */
export type MatchInsightRelevance = "HIGH" | "MEDIUM" | "CONTEXTUAL";

/** Confidence is about how much evidence exists, not how good it is — reuses ADR-0094's
 * `ConfidenceLevel` vocabulary (`INSUFFICIENT`/`EMERGING`/`ESTABLISHED`) for combination facts,
 * and a simpler HIGH/MEDIUM/LOW sample-size tier for everything else. */
export type MatchInsightSampleConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MatchInsightFactType =
  | "STARTING_PATTERN"
  | "POSITION_PATTERN"
  | "POSITION_EXPOSURE"
  | "ATTRIBUTE_PROFILE"
  | "GOAL_INVOLVEMENT"
  | "GOAL_COMBINATION"
  | "STARTS_TOGETHER"
  | "NEW_COMBINATION"
  | "LINEUP_CONTINUITY"
  | "FORMATION_PATTERN"
  | "DEVELOPMENT_CONTEXT"
  | "OPPONENT_ENCOUNTER"
  | "OPPONENT_OBSERVATION"
  | "OPPONENT_TREND"
  | "ROTATION_CONTEXT"
  | "MATCH_AVAILABILITY"
  | "MATCH_DAY_ADDITION";

/**
 * One deterministic, evidence-backed fact. `id` is stable for the lifetime of one context build
 * (used as an evidence ref, e.g. `fact:starting-pattern:<playerId>`) — never a database id, and
 * never reused across unrelated facts. `subjectRefs` holds real `playerId`s (and the `matchId`
 * for match-scoped facts); callers that build an AI context translate these to ephemeral refs
 * themselves.
 */
export type MatchInsightFact = {
  id: string;
  type: MatchInsightFactType;
  subjectRefs: string[];
  period?: {
    kind: "MATCH" | "RECENT_MATCHES" | "SEASON" | "PREVIOUS_ENCOUNTERS" | "ALL_TIME";
    count?: number;
  };
  value: Record<string, unknown>;
  sample?: {
    matches?: number;
    starts?: number;
    minutes?: number;
  };
  evidenceRefs: string[];
  /** Higher sorts first within `ranking.ts`'s deterministic ordering — not shown to the coach. */
  deterministicPriority: number;
  confidence?: MatchInsightSampleConfidence;
};

export type MatchInsightCategory =
  | "OPPONENT_HISTORY"
  | "CURRENT_PLAN"
  | "COMBINATION"
  | "POSITION"
  | "PLAYER_PROFILE"
  | "OPPORTUNITY"
  | "DEVELOPMENT"
  | "TEAM_PATTERN"
  | "OBSERVATION_FOCUS";

/** A deterministic candidate insight — Layer A's directly-renderable output, and the same shape
 * an accepted AI insight is normalized into once `ranking.ts` derives its category/relevance
 * (ADR-0149 Decision 2: category/relevance are always Matchboard-computed, never AI-emitted). */
export type MatchInsightCandidate = {
  id: string;
  category: MatchInsightCategory;
  relevance: MatchInsightRelevance;
  title: string;
  observation: string;
  implication?: string;
  subjectRefs: string[];
  factRefs: string[];
  evidenceRefs: string[];
  confidence?: MatchInsightSampleConfidence;
  source: "DETERMINISTIC" | "AI";
};

export type PositionEvidenceEntry = {
  position: string;
  minutes: number;
  confidence: MatchInsightSampleConfidence;
};

export type PlayerAttributeProfile = Partial<Record<RatingAttributeKey, number | null>> & {
  technical: number | null;
  tactical: number | null;
  mental: number | null;
  physical: number | null;
};

export type PlayerPreparationSummary = {
  playerId: string;
  declaredPositions: {
    primary: string;
    secondary: string | null;
    tertiary: string | null;
  };
  positionEvidence: PositionEvidenceEntry[];
  attributes: PlayerAttributeProfile;
  season: {
    appearances: number;
    goals: number;
    assists: number;
  };
  recent: {
    matchesConsidered: number;
    starts: number;
    minutes: number;
  };
  development: {
    category: string;
  }[];
};

export type PairCombinationSummary = {
  playerIds: [string, string];
  family: string;
  subtype: string | null;
  totalMinutesTogether: number;
  matchCount: number;
  goalsForTotal: number;
  directGoalContributionsTotal: number;
  directAssistContributionsTotal: number;
  confidence: ConfidenceLevel;
};

export type TrustedOpponentObservation = {
  /** Bounded, truncated, attributed — never presented as objective fact (ADR-0149 Decision 3). */
  text: string;
  encounterDate: Date;
  source: "OPPONENT_ENCOUNTER_SUMMARY" | "POST_MATCH_TEAM_NOTE";
};

export type PreviousEncounterSummary = {
  matchId: string;
  occurredAt: Date;
  goalsFor: number;
  goalsAgainst: number;
  formation: string | null;
  overallEnvironment: string | null;
  sportingLevel: string | null;
  playingStyleTags: string[];
  concernCategories: string[];
  trustedObservation: TrustedOpponentObservation | null;
};

export type OpponentPreparationContext = {
  opponentTeamId: string | null;
  exactOpponentHistoryAvailable: boolean;
  previousEncounterCount: number;
  previousEncounters: PreviousEncounterSummary[];
  /** Combination evidence recorded specifically in matches against this exact opponent — never
   * inferred from name/reputation (bundle §8: "Never infer opponent characteristics from name,
   * club, league reputation, or internet knowledge"). */
  establishedCombinationsAgainstOpponent: PairCombinationSummary[];
};

export type TeamHistoryContext = {
  formationFamiliarity: {
    formation: string;
    matchesUsedInWindow: number;
    windowSize: number;
  } | null;
  lineupContinuity: {
    previousMatchId: string | null;
    unchangedPlayerCount: number;
    changedPlayerCount: number;
    previousSquadSize: number;
  } | null;
};

export type CurrentPlanRotationChange = {
  sequence: number;
  outPlayerId: string | null;
  inPlayerId: string | null;
  outPosition: string | null;
  inPosition: string | null;
};

export type CurrentPlanSquadEntry = {
  playerId: string;
  role: "CORE" | "SUPPORT" | "DEVELOPMENT";
  position: string | null;
};

/** The current plan, as already assembled by the caller (Selection/MatchLineup reads) — this
 * domain layer never re-derives it. ADR-0151 adds `operationalRoster` and `plannedSquad`:
 * `squad` remains the original planned squad (Selection rows) for backward compatibility;
 * `operationalRoster` is the effective match-day roster (selections + additions - absences + guests);
 * `plannedSquad` is an alias for `squad` made explicit for comparison reasoning. */
export type OperationalRosterEntry = {
  playerId: string | null;
  guestPlayerId?: string | null;
  participantType: "PLAYER" | "GUEST_PLAYER";
  source: "planned" | "helper" | "match_day_addition" | "guest";
  provenance: HelperProvenance | null;
  role: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
  position: string | null;
  isActiveParticipant: boolean;
  absenceReason: PlannedAbsenceReason | null;
};

export type CurrentPlanInput = {
  matchId: string;
  teamId: string;
  organisationId: string;
  leagueSeasonId: string;
  opponentTeamId: string | null;
  formation: string | null;
  matchStartsAt: Date;
  /** @deprecated Use operationalRoster for active-participant reasoning and squad for planned-squad reasoning */
  squad: CurrentPlanSquadEntry[];
  /** Effective match-day roster: selections + additions - absences + guests (ADR-0151) */
  operationalRoster: OperationalRosterEntry[];
  plannedRotations: CurrentPlanRotationChange[];
};

export type MatchInsightFactBundle = {
  facts: MatchInsightFact[];
  playerSummaries: Map<string, PlayerPreparationSummary>;
  opponentContext: OpponentPreparationContext;
  teamHistory: TeamHistoryContext;
  pairCombinations: PairCombinationSummary[];
};
