export type {
  FootballObservationCode,
  ObservationPolarity,
  EvidenceClass,
  ObservationDefinition,
} from "./observation-vocabulary";

export {
  OBSERVATION_DEFINITIONS,
  ALL_OBSERVATION_CODES,
  getObservationDefinition,
  getObservationLabel,
  isValidObservationCode,
} from "./observation-vocabulary";

export type {
  AttributeMappingTarget,
  ObservationMappingEntry,
} from "./observation-mapping";

export {
  OBSERVATION_ATTRIBUTE_MAPPINGS,
  MAPPING_VERSION,
  RATING_ATTRIBUTE_KEYS as EVIDENCE_RATING_ATTRIBUTE_KEYS,
  getEvidenceTargets,
  getDirectTargets,
  getSupportingTargets,
  verifyFullAttributeCoverage,
} from "./observation-mapping";

export type {
  EvidenceSource,
  EvidenceProvenance,
  ExtractedEvidence,
  EvidenceAccumulator,
  AssessmentDirection,
  AssessmentProposal,
} from "./evidence-accumulator";

export {
  EVIDENCE_ENGINE_VERSION,
  POSITIVE_THRESHOLD,
  NEGATIVE_THRESHOLD,
  MINIMUM_DISTINCT_MATCHES,
  MAX_CHANGE_PER_STEP,
  MIN_RATING,
  MAX_RATING as EVIDENCE_MAX_RATING,
  createAccumulator,
  accumulateEvidence,
  computeDistinctMatchCount,
  computeAssessmentProposal,
} from "./evidence-accumulator";

export type {
  AssessmentChangeSource,
  AssessmentChangeTargetType,
  CreateAssessmentChangeInput,
} from "./assessment-change";

export {
  recordAssessmentChange,
  recordManualRebase,
  getAssessmentHistory,
  setPlayerEvidenceCutover,
  getPlayerEvidenceCutover,
} from "./assessment-change";

export type {
  FootballObservationInput,
  BatchObservationResult,
} from "./football-observation-service";

export {
  createFootballObservations,
  getFootballObservationsForPlayer,
  getFootballObservationsForMatch,
} from "./football-observation-service";

export type {
  PlayerRatingBaseline,
} from "./historical-baseline";

export {
  captureOrganisationBaselines,
  getPlayerRatingBaseline,
} from "./historical-baseline";

export type {
  LineupPosition,
  LineupChangeEntry,
  CompositeLineupChange,
  ProjectedLineup,
  StarterAssignment,
} from "./lineup-state";

export {
  projectLineupFromEvents,
  computePositionIntervals,
  getLineupAtGoalTime,
  validateCompositeLineupChange,
  computeTotalMinutesByPosition,
} from "./lineup-state";

export type {
  DataQualityTier,
  LineupStateInterval,
  EffectivePlayerStrength,
  LineupStateStrength,
  OpponentEncounterEvidenceInput,
  OpponentEncounterEvidenceResult,
  OpponentContextSignal,
  HistoricalDryRunResult,
} from "./opponent-engine";

export {
  OPPONENT_ENGINE_VERSION,
  classifyDataQuality,
  computePositionSuitability,
  computeEffectivePlayerStrength,
  computeLineupStateStrengths,
  computeEncounterEvidenceFromLineupStates,
  computeWholeMatchEstimate,
} from "./opponent-engine";

export type {
  OpponentAssessmentSource,
  OpponentConfidence,
  RecordOpponentAssessmentChangeInput,
} from "./opponent-assessment-change";

export {
  recordOpponentAssessmentChange,
  getOpponentAssessmentHistory,
  getLatestOpponentAssessment,
} from "./opponent-assessment-change";

export { dryRunOpponentEvidence } from "./opponent-replay";

export type {
  MatchObservationEvidence,
  MatchContextEvidence,
  PlayerEvidenceInput,
  PlayerAssessmentResult,
  GoalkeeperAssessmentProposal,
  PositionEvidenceMapping,
} from "./player-evidence-service";

export {
  computePlayerAssessmentProposals,
  applyPlayerAssessmentProposals,
  computeAndApplyPlayerEvidenceForMatch,
} from "./player-evidence-service";