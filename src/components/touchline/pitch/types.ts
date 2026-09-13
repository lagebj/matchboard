/**
 * Shared pitch types (Atlas Follow-up, `06_CANONICAL_PITCH_RENDERING_CONTRACT.md`).
 *
 * Canonical football orientation, everywhere: own GK at the bottom, own team attacks upward.
 * `longitudinal: 0` = own goal line, `longitudinal: 1` = opponent goal line.
 * `lateral: 0` = pitch left (from the attacking team's own perspective), `lateral: 1` = pitch right.
 * No automatic mirroring for home/away (contract §2).
 */
export type NormalizedPitchPoint = {
  lateral: number;
  longitudinal: number;
};

/**
 * A point already projected into the visual pitch plane, as percentages of the pitch-surface
 * box, plus a token-scale multiplier for perspective depth (contract §4).
 */
export type ScreenPitchPoint = {
  xPct: number;
  yPct: number;
  perspectiveScale: number;
};

export type PitchStyle = "planning" | "flat";

export type PitchShirtTokenStatus = "normal" | "attention" | "unavailable";
