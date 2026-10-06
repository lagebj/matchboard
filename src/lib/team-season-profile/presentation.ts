import { ROLE_TYPE_LABELS } from "@/lib/formations/types";
import type { ConfidenceLevel, TeamSeasonPattern, TeamSeasonPatternTrajectory } from "@/lib/team-season-profile/contracts";

/**
 * Deterministic coach-readable presentation for Team Season Profile patterns (ADR-0156 §07/§08
 * `TEAM_DETAIL_UX.md`/`TEAMS_OVERVIEW_UX.md`: "the overview uses deterministic short labels ...
 * centralize them in Team Season Profile presentation logic", never derived in a page
 * component). No AI prose anywhere in this module -- every string is built from `pattern.metrics`
 * /`pattern.sample`, nothing else. Player names are supplied by the caller (this module never
 * queries the database) via a `playerName` lookup.
 */

export type PlayerNameLookup = (playerId: string) => string;

const defaultPlayerName: PlayerNameLookup = (playerId) => playerId;

/** §04 §7 — coach-facing confidence labels. `INSUFFICIENT` never reaches this module: every
 * family builder already excludes it from the `patterns` array before this is ever called. */
const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  INSUFFICIENT: "",
  EMERGING: "Emerging pattern",
  ESTABLISHED: "Established pattern",
};

/** §04 §7 — trajectory presentation labels (the stored enum value is never shown directly). */
const TRAJECTORY_LABELS: Record<TeamSeasonPatternTrajectory, string | null> = {
  NEW: "New",
  PERSISTENT: "Persistent",
  STRENGTHENING: "Stronger recently",
  WEAKENING: "Less evident recently",
  MIXED: "Mixed recently",
  DORMANT: "Not seen recently",
};

export function confidenceLabel(level: ConfidenceLevel): string {
  return CONFIDENCE_LABELS[level];
}

export function trajectoryLabel(trajectory: TeamSeasonPatternTrajectory): string | null {
  return TRAJECTORY_LABELS[trajectory];
}

export type PatternViewModel = {
  key: string;
  family: TeamSeasonPattern["family"];
  title: string;
  evidenceSentence: string;
  secondarySentence: string | null;
  sampleLine: string;
  confidenceLabel: string;
  trajectoryLabel: string | null;
  tone: TeamSeasonPattern["tone"];
  approximateTiming: boolean;
  playerIds: string[];
  /** True for every COMBINATION pattern -- the UI shows the shared "association, not causation"
   * note once per section for these, never repeated per card (§07 §9). */
  isCombination: boolean;
};

function metricNumber(pattern: TeamSeasonPattern, key: string): number {
  const value = pattern.metrics[key];
  return typeof value === "number" ? value : 0;
}

function metricString(pattern: TeamSeasonPattern, key: string): string | null {
  const value = pattern.metrics[key];
  return typeof value === "string" ? value : null;
}

const RHYTHM_WINDOW_LABELS: Record<string, string> = {
  OPENING_FIRST_HALF: "opening phase",
  OPENING_RESTART: "restart phase",
  LATE_FINAL: "closing phase",
};

const RHYTHM_TITLES: Record<string, string> = {
  OPENING_FIRST_HALF_FOR: "Strong starts",
  OPENING_FIRST_HALF_AGAINST: "Early concessions",
  OPENING_RESTART_FOR: "Fast restarts",
  OPENING_RESTART_AGAINST: "Concedes after restart",
  LATE_FINAL_FOR: "Strong finishes",
  LATE_FINAL_AGAINST: "Late concessions",
  FIRST_GOAL_DIRECTION: "First goal pattern",
};

function presentMatchRhythm(pattern: TeamSeasonPattern): Pick<PatternViewModel, "title" | "evidenceSentence" | "secondarySentence" | "sampleLine"> {
  const title = RHYTHM_TITLES[pattern.subtype] ?? pattern.subtype;

  if (pattern.subtype === "FIRST_GOAL_DIRECTION") {
    const scoredFirst = metricNumber(pattern, "scoredFirst");
    const concededFirst = metricNumber(pattern, "concededFirst");
    const matches = metricNumber(pattern, "matchesWithFirstGoal");
    return {
      title,
      evidenceSentence: `Scored first in ${scoredFirst} of ${matches} matches with an identifiable first goal; conceded first in ${concededFirst}.`,
      secondarySentence: null,
      sampleLine: `${matches} matches with an identifiable first goal`,
    };
  }

  const direction = pattern.subtype.endsWith("_FOR") ? "FOR" : "AGAINST";
  const windowPrefix = pattern.subtype.replace(/_FOR$|_AGAINST$/, "");
  const windowLabel = RHYTHM_WINDOW_LABELS[windowPrefix] ?? "that phase";
  const candidateGoals = metricNumber(pattern, "candidateGoals");
  const allGoals = metricNumber(pattern, "allGoalsInEligibleMatches");
  const goalWord = direction === "FOR" ? "goals" : "goals against";

  return {
    title,
    evidenceSentence: `${candidateGoals} of ${allGoals} recorded ${goalWord} came in the ${windowLabel} across ${pattern.sample.matches} matches.`,
    secondarySentence: null,
    sampleLine: `${pattern.sample.matches} matches · ${Math.round(metricNumber(pattern, "candidateExposureMinutes"))} min exposure in that window`,
  };
}

const THEME_PHASE_LABELS: Record<string, string> = {
  GENERAL: "General play",
  BUILD_UP: "Build-up",
  PROGRESSION: "Progression",
  CHANCE_CREATION: "Chance creation",
  PRESSING: "Pressing",
  DEFENSIVE_SHAPE: "Defensive shape",
  DEFENSIVE_TRANSITION: "Defensive transition",
  ATTACKING_TRANSITION: "Attacking transition",
  SET_PLAYS: "Set plays",
};

function themeTitle(subtype: string): string {
  const phase = subtype.replace(/_WORKING$|_PROBLEM$|_MIXED$/, "");
  return THEME_PHASE_LABELS[phase] ?? phase;
}

function presentTacticalTheme(pattern: TeamSeasonPattern): Pick<PatternViewModel, "title" | "evidenceSentence" | "secondarySentence" | "sampleLine"> {
  const title = themeTitle(pattern.subtype);
  const recentMatches = pattern.sample.recentMatches;

  if (pattern.subtype.endsWith("_MIXED")) {
    const workingMatches = metricNumber(pattern, "workingMatches");
    const problemMatches = metricNumber(pattern, "problemMatches");
    return {
      title,
      evidenceSentence: `Evidence is mixed this season: working evidence in ${workingMatches} matches and problem evidence in ${problemMatches} matches.`,
      secondarySentence: null,
      sampleLine: `${pattern.sample.matches} matches with relevant observations`,
    };
  }

  const isProblem = pattern.subtype.endsWith("_PROBLEM");
  const direction = isProblem ? "a problem" : "working";
  const recentClause = recentMatches && recentMatches > 0 ? `, including ${recentMatches} of the last 4` : "";

  return {
    title,
    evidenceSentence: `Recorded as ${direction} in ${pattern.sample.matches} matches this season${recentClause}.`,
    secondarySentence: null,
    sampleLine: `${pattern.sample.matches} matches · ${pattern.sample.observationCount ?? 0} observations`,
  };
}

function presentPlayerContribution(pattern: TeamSeasonPattern, playerName: PlayerNameLookup): Pick<PatternViewModel, "title" | "evidenceSentence" | "secondarySentence" | "sampleLine"> {
  const playerId = pattern.subjects.playerIds?.[0] ?? "";
  const name = playerName(playerId);
  const isGoal = pattern.subtype === "GOAL_CONTRIBUTION";
  const eventCount = metricNumber(pattern, "eventCount");
  const totalMinutes = Math.round(metricNumber(pattern, "totalMinutes"));
  const totalMatches = metricNumber(pattern, "totalMatches");
  const dominantPosition = metricString(pattern, "dominantPosition");
  const dominantCount = metricNumber(pattern, "dominantPositionCount");
  const positionLabel = dominantPosition ? (ROLE_TYPE_LABELS[dominantPosition as keyof typeof ROLE_TYPE_LABELS] ?? dominantPosition).toLowerCase() : null;

  if (isGoal) {
    const positionClause = positionLabel ? `, mainly while used as a ${positionLabel}` : "";
    return {
      title: `${name} · Goals`,
      evidenceSentence: `${name} has ${eventCount} recorded goals in ${totalMinutes} minutes across ${totalMatches} matches${positionClause}.`,
      secondarySentence: "No player ranking is implied.",
      sampleLine: `${totalMinutes} min · ${totalMatches} matches`,
    };
  }

  return {
    title: `${name} · Assists`,
    evidenceSentence: `${name} has ${eventCount} recorded assists across ${totalMatches} matches.`,
    secondarySentence: positionLabel ? `${dominantCount} of these came while positioned as a ${positionLabel}.` : "No player ranking is implied.",
    sampleLine: `${totalMinutes} min · ${totalMatches} matches`,
  };
}

const PARTNERSHIP_LABELS: Record<string, string> = {
  HORIZONTAL: "side-by-side partnership",
  VERTICAL: "vertical partnership",
  GOALKEEPER_LINK: "goalkeeper link",
};
const TRIANGLE_LABELS: Record<string, string> = {
  DEFENSIVE: "defensive triangle",
  CENTRAL_SPINE: "central-spine triangle",
  WIDE: "wide triangle",
  MIDFIELD: "midfield triangle",
  ATTACKING: "attacking triangle",
};
const FUNCTIONAL_UNIT_LABELS: Record<string, string> = {
  BUILD_UP: "build-up unit",
  DEFENSIVE_CORE: "defensive core",
  CENTRAL_UNIT: "central unit",
  ATTACKING_UNIT: "attacking unit",
};
const CORRIDOR_LABELS: Record<string, string> = { LEFT: "left corridor", CENTRE: "centre corridor", RIGHT: "right corridor" };

function combinationDescriptor(pattern: TeamSeasonPattern): string {
  const subtype = pattern.subtype.replace(/^PARTNERSHIP_|^TRIANGLE_|^FUNCTIONAL_UNIT_|^CORRIDOR_/, "");
  if (pattern.subtype.startsWith("PARTNERSHIP")) return PARTNERSHIP_LABELS[subtype] ?? "partnership";
  if (pattern.subtype.startsWith("TRIANGLE")) return TRIANGLE_LABELS[subtype] ?? "triangle";
  if (pattern.subtype.startsWith("FUNCTIONAL_UNIT")) return FUNCTIONAL_UNIT_LABELS[subtype] ?? "functional unit";
  if (pattern.subtype.startsWith("CORRIDOR")) return CORRIDOR_LABELS[subtype] ?? "corridor";
  return "combination";
}

function presentCombination(pattern: TeamSeasonPattern, playerName: PlayerNameLookup): Pick<PatternViewModel, "title" | "evidenceSentence" | "secondarySentence" | "sampleLine"> {
  const names = (pattern.subjects.playerIds ?? []).map(playerName);
  const namesLabel = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
  const descriptor = combinationDescriptor(pattern);
  const minutes = Math.round(metricNumber(pattern, "minutesTogether"));
  const matches = metricNumber(pattern, "matchCount");
  const opponentDiversity = metricNumber(pattern, "opponentDiversity");
  const goalsFor = metricNumber(pattern, "goalsForWhilePresent");
  const directTotal = metricNumber(pattern, "directGoalContributions") + metricNumber(pattern, "directAssistContributions");
  const opponentClause = opponentDiversity > 0 ? ` and ${opponentDiversity} opponent${opponentDiversity === 1 ? "" : "s"}` : "";

  const titlePrefix = descriptor.charAt(0).toUpperCase() + descriptor.slice(1);

  return {
    title: `${titlePrefix} · ${namesLabel}`,
    evidenceSentence: `${namesLabel} shared the ${descriptor} for ${minutes} minutes across ${matches} matches${opponentClause}.`,
    secondarySentence: `Matchboard recorded ${goalsFor} goals for while this combination was present; the players had ${directTotal} direct goal or assist contribution${directTotal === 1 ? "" : "s"}.`,
    sampleLine: `${minutes} min · ${matches} matches${opponentDiversity > 0 ? ` · ${opponentDiversity} opponents` : ""}`,
  };
}

export function presentPattern(pattern: TeamSeasonPattern, playerName: PlayerNameLookup = defaultPlayerName): PatternViewModel {
  const body =
    pattern.family === "MATCH_RHYTHM"
      ? presentMatchRhythm(pattern)
      : pattern.family === "TACTICAL_THEME"
        ? presentTacticalTheme(pattern)
        : pattern.family === "PLAYER_CONTRIBUTION"
          ? presentPlayerContribution(pattern, playerName)
          : presentCombination(pattern, playerName);

  return {
    key: pattern.key,
    family: pattern.family,
    title: body.title,
    evidenceSentence: body.evidenceSentence,
    secondarySentence: body.secondarySentence,
    sampleLine: body.sampleLine,
    confidenceLabel: confidenceLabel(pattern.evidenceStrength),
    trajectoryLabel: trajectoryLabel(pattern.trajectory),
    tone: pattern.tone,
    approximateTiming: pattern.approximateTiming,
    playerIds: pattern.subjects.playerIds ?? [],
    isCombination: pattern.family === "COMBINATION",
  };
}

/**
 * Teams-overview compact chip label (§08 §4) -- a short, deterministic label, never a full
 * sentence and never AI prose. Centralized here so the page component never derives one itself.
 */
const SHORT_LABELS: Record<string, string> = {
  OPENING_FIRST_HALF_FOR: "Strong starts",
  OPENING_RESTART_FOR: "Fast restarts",
  OPENING_FIRST_HALF_AGAINST: "Early concessions",
  OPENING_RESTART_AGAINST: "Concedes after restart",
  LATE_FINAL_FOR: "Strong finishes",
  LATE_FINAL_AGAINST: "Late concessions",
  FIRST_GOAL_DIRECTION: "First-goal pattern",
};

export function shortPatternLabel(pattern: TeamSeasonPattern): string {
  if (pattern.family === "MATCH_RHYTHM") return SHORT_LABELS[pattern.subtype] ?? "Match rhythm pattern";

  if (pattern.family === "TACTICAL_THEME") {
    const theme = themeTitle(pattern.subtype);
    if (pattern.subtype.endsWith("_WORKING")) return `${theme} working`;
    if (pattern.subtype.endsWith("_MIXED")) return `${theme} mixed`;
    return `${theme} issue recurring`;
  }

  if (pattern.family === "COMBINATION") {
    if (pattern.subtype.startsWith("CORRIDOR")) {
      const side = pattern.subtype.replace("CORRIDOR_", "");
      return `${side.charAt(0) + side.slice(1).toLowerCase()}-side combination`;
    }
    return "Combination evidence";
  }

  return pattern.subtype === "GOAL_CONTRIBUTION" ? "Goal contribution" : "Assist contribution";
}
