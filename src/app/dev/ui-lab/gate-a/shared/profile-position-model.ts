import {
  CANONICAL_TACTICAL_POSITIONS,
  type CanonicalTacticalPosition,
} from "@/domain/positions/roles";

/**
 * Gate A W1 UI Lab candidate — dev-only 14-role "profile" vocabulary (programme_v054
 * `15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md` / `16_POSITION_SEMANTICS_TRACEABILITY.csv`,
 * direction formally approved 2026-10-09).
 *
 * This is NOT a production vocabulary. It exists only under `/dev/ui-lab/gate-a/**` to let a
 * human visually compare a 14-role coach-facing profile picker against the real, shipped 24-code
 * `CanonicalTacticalPosition` vocabulary (`src/domain/positions/roles.ts`, ADR-0154). No production
 * code imports this module. `PlayerEditorForm` / `player-form-options.ts` are untouched and keep
 * offering all 24 sided codes until a separately-authorized domain migration happens.
 *
 * `DM`, `AM`, `F` are unsided profile labels whose real stored canonical candidate would be the
 * centre-line code (`CDM`/`CAM`/`CF`) — surfaced here only as display metadata, never written
 * anywhere.
 */
export const PROFILE_POSITIONS = [
  "GK",
  "LB",
  "CB",
  "RB",
  "LWB",
  "DM",
  "RWB",
  "LM",
  "CM",
  "RM",
  "LW",
  "AM",
  "RW",
  "F",
] as const;

export type ProfilePosition = (typeof PROFILE_POSITIONS)[number];

const PROFILE_POSITION_SET: ReadonlySet<string> = new Set(PROFILE_POSITIONS);

export function isProfilePosition(value: string): value is ProfilePosition {
  return PROFILE_POSITION_SET.has(value);
}

/** The unsided profile label's nearest canonical centre-line stored candidate, display-only. */
export const PROFILE_STORED_CANDIDATE: Partial<Record<ProfilePosition, CanonicalTacticalPosition>> = {
  DM: "CDM",
  AM: "CAM",
  F: "CF",
};

/**
 * Which 24-code canonical tactical positions collapse into each 14-role profile label
 * (`16_POSITION_SEMANTICS_TRACEABILITY.csv`). Every canonical code appears in exactly one group —
 * collapsing never drops or double-counts a code.
 */
export const PROFILE_TO_TACTICAL_GROUP: Readonly<Record<ProfilePosition, readonly CanonicalTacticalPosition[]>> = {
  GK: ["GK"],
  LB: ["LB"],
  CB: ["LCB", "CB", "RCB"],
  RB: ["RB"],
  LWB: ["LWB"],
  DM: ["LDM", "CDM", "RDM"],
  RWB: ["RWB"],
  LM: ["LM"],
  CM: ["LCM", "CM", "RCM"],
  RM: ["RM"],
  LW: ["LW"],
  AM: ["LAM", "CAM", "RAM"],
  RW: ["RW"],
  F: ["LCF", "CF", "RCF"],
};

const TACTICAL_TO_PROFILE = new Map<CanonicalTacticalPosition, ProfilePosition>();
for (const [profile, group] of Object.entries(PROFILE_TO_TACTICAL_GROUP) as [ProfilePosition, readonly CanonicalTacticalPosition[]][]) {
  for (const tactical of group) TACTICAL_TO_PROFILE.set(tactical, profile);
}

/**
 * Collapses one exact 24-code tactical position down to its 14-role profile label. Every one of
 * the 24 `CANONICAL_TACTICAL_POSITIONS` is covered (asserted in the test suite) — this throws
 * rather than silently guessing if the vocabulary ever changes underneath this candidate.
 */
export function collapseTacticalToProfile(tactical: CanonicalTacticalPosition): ProfilePosition {
  const profile = TACTICAL_TO_PROFILE.get(tactical);
  if (!profile) {
    throw new Error(`No profile-position mapping for canonical tactical position "${tactical}"`);
  }
  return profile;
}

/** Sanity cross-check: every canonical 24-code position is covered by exactly one profile group. */
export function allCanonicalTacticalPositionsCovered(): boolean {
  return CANONICAL_TACTICAL_POSITIONS.every((code) => TACTICAL_TO_PROFILE.has(code));
}

/**
 * Flat 3-lane × 6-line analytical grid coordinates for the profile positions
 * (`13_DISTINCTIVE_EXPERIENCE_REQUIREMENTS.md` XR-P02: "flat 3×6, GK bottom, attack top, no
 * shirts"). Unlike `TouchlinePositionMap`'s perspective-projected 5×6 tactical grid, this is a
 * plain orthogonal grid — no trapezoid, no depth scale.
 *
 * PR #777 remediation (repository-owner correction, 2026-10-09): every one of the 14 profile
 * positions now has its own unique `(lane, line)` cell — `LB`/`LWB` and `RB`/`RWB` previously
 * shared a cell with their full-back counterpart; a player with evidence at both must be able to
 * show both simultaneously and distinguishably, so each now owns its own line:
 *
 * - Line 0 (attack):            —    F   —
 * - Line 1:                    LW   AM   RW
 * - Line 2:                    LM   CM   RM
 * - Line 3 (def. mid/wing-back): LWB  DM  RWB
 * - Line 4 (defence):           LB   CB   RB
 * - Line 5 (goalkeeper):         —   GK   —
 */
export const PROFILE_FLAT_GRID: Readonly<Record<ProfilePosition, { lane: "LEFT" | "CENTRE" | "RIGHT"; line: number }>> = {
  F: { lane: "CENTRE", line: 0 },
  LW: { lane: "LEFT", line: 1 },
  AM: { lane: "CENTRE", line: 1 },
  RW: { lane: "RIGHT", line: 1 },
  LM: { lane: "LEFT", line: 2 },
  CM: { lane: "CENTRE", line: 2 },
  RM: { lane: "RIGHT", line: 2 },
  LWB: { lane: "LEFT", line: 3 },
  DM: { lane: "CENTRE", line: 3 },
  RWB: { lane: "RIGHT", line: 3 },
  LB: { lane: "LEFT", line: 4 },
  CB: { lane: "CENTRE", line: 4 },
  RB: { lane: "RIGHT", line: 4 },
  GK: { lane: "CENTRE", line: 5 },
};

export const PROFILE_GRID_LINE_COUNT = 6;

/** Every `(lane, line)` cell in `PROFILE_FLAT_GRID` is unique — asserted in the test suite, not
 * just by construction, so a future edit that reintroduces a collision fails loudly. */
export function profileFlatGridCellKey(position: ProfilePosition): string {
  const { lane, line } = PROFILE_FLAT_GRID[position];
  return `${lane}:${line}`;
}

const LANE_PERCENT: Record<"LEFT" | "CENTRE" | "RIGHT", number> = {
  LEFT: 18,
  CENTRE: 50,
  RIGHT: 82,
};

/** Flat (non-perspective) screen percentages for a profile position, attack at the top (yPct 0). */
export function profilePositionToFlatPoint(position: ProfilePosition): { xPct: number; yPct: number } {
  const { lane, line } = PROFILE_FLAT_GRID[position];
  return {
    xPct: LANE_PERCENT[lane],
    yPct: (line / (PROFILE_GRID_LINE_COUNT - 1)) * 100,
  };
}

export type ExactPositionAppearance = {
  matchId: string;
  tacticalPosition: CanonicalTacticalPosition;
  minutes: number;
};

export type ProfileEvidenceAggregate = {
  profile: ProfilePosition;
  totalMinutes: number;
  /** Distinct matches contributing to this profile — a match that used two sided codes from the
   * same profile group (e.g. LCM then RCM in one match) counts once, never twice (A12:
   * "no double-selection/double-count after projection"). */
  appearanceCount: number;
  breakdown: { tacticalPosition: CanonicalTacticalPosition; minutes: number }[];
};

/**
 * Aggregates exact 24-code match appearances into 14-role profile evidence, preserving total
 * minutes and distinct-match counts exactly — never dropping, double-counting, or rewriting a
 * historical interval (`20_UI_LAB_CANDIDATE_WAVES.md` A12: "historical exact-side preservation,
 * no dedup loss"). E.g. 20 minutes at `LCM` + 10 minutes at `RCM` in different matches aggregates
 * to `CM`: 30 total minutes, 2 appearances — both sided intervals are preserved in `breakdown`,
 * neither is rewritten to `CM` in place.
 */
export function aggregateExactAppearancesByProfile(appearances: readonly ExactPositionAppearance[]): ProfileEvidenceAggregate[] {
  const byProfile = new Map<ProfilePosition, { totalMinutes: number; matchIds: Set<string>; breakdown: { tacticalPosition: CanonicalTacticalPosition; minutes: number }[] }>();

  for (const appearance of appearances) {
    const profile = collapseTacticalToProfile(appearance.tacticalPosition);
    const bucket = byProfile.get(profile) ?? { totalMinutes: 0, matchIds: new Set<string>(), breakdown: [] };
    bucket.totalMinutes += appearance.minutes;
    bucket.matchIds.add(appearance.matchId);
    bucket.breakdown.push({ tacticalPosition: appearance.tacticalPosition, minutes: appearance.minutes });
    byProfile.set(profile, bucket);
  }

  return Array.from(byProfile.entries()).map(([profile, bucket]) => ({
    profile,
    totalMinutes: bucket.totalMinutes,
    appearanceCount: bucket.matchIds.size,
    breakdown: bucket.breakdown,
  }));
}
