/**
 * Human-readable labels for exact position codes (Atlas Follow-up Player Detail migration).
 * Covers every code `src/components/touchline/pitch/position-coordinates.ts`'s
 * `POSITION_GRID` can place on the canonical position map, plus the declared-position codes
 * (`GK`/`CB`/`CM`/`W`/`ST`, per `playerPositionValues`). Unknown codes fall back to the raw
 * code itself — never a blank or an invented name.
 */
export const EXACT_POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeeper",
  CB: "Centre Back",
  LB: "Left Back",
  RB: "Right Back",
  CM: "Centre Midfield",
  DM: "Defensive Midfield",
  AM: "Attacking Midfield",
  LM: "Left Midfield",
  RM: "Right Midfield",
  WM: "Wide Midfield",
  LW: "Left Wing",
  RW: "Right Wing",
  W: "Wing",
  ST: "Striker",
  CF: "Centre Forward",
};

export function exactPositionLabel(code: string): string {
  return EXACT_POSITION_LABELS[code] ?? code;
}