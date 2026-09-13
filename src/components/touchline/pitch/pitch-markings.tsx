import { projectFlatPitchPoint, projectPlanningPitchPoint } from "./projection";
import type { NormalizedPitchPoint } from "./types";

/**
 * Real full-size pitch dimensions (metres) — used only to derive normalized fractions for the
 * marking geometry below, matching the same proportions `src/components/formations/tactics-board.tsx`
 * already uses (`PITCH_WIDTH`/`PITCH_HEIGHT`/`PA_W`/`PA_H`/`GA_W`/`GA_H`/`CENTER_R`/`PENALTY_SPOT`/
 * `GOAL_W`), so the two implementations describe the same real pitch, not two different ones.
 */
const PITCH_LENGTH_M = 105;
const PITCH_WIDTH_M = 68;
const PENALTY_AREA_DEPTH_M = 16.5;
const PENALTY_AREA_WIDTH_M = 40.32;
const GOAL_AREA_DEPTH_M = 5.5;
const GOAL_AREA_WIDTH_M = 18.32;
const CENTER_CIRCLE_RADIUS_M = 9.15;
const PENALTY_SPOT_M = 11;
const GOAL_WIDTH_M = 7.32;

const PA_DEPTH_FRAC = PENALTY_AREA_DEPTH_M / PITCH_LENGTH_M;
const PA_HALF_WIDTH_FRAC = PENALTY_AREA_WIDTH_M / PITCH_WIDTH_M / 2;
const GA_DEPTH_FRAC = GOAL_AREA_DEPTH_M / PITCH_LENGTH_M;
const GA_HALF_WIDTH_FRAC = GOAL_AREA_WIDTH_M / PITCH_WIDTH_M / 2;
const SPOT_FRAC = PENALTY_SPOT_M / PITCH_LENGTH_M;
const GOAL_HALF_WIDTH_FRAC = GOAL_WIDTH_M / PITCH_WIDTH_M / 2;
const CIRCLE_R_LATERAL_FRAC = CENTER_CIRCLE_RADIUS_M / PITCH_WIDTH_M;
const CIRCLE_R_LONGITUDINAL_FRAC = CENTER_CIRCLE_RADIUS_M / PITCH_LENGTH_M;

function circlePoints(centerLateral: number, centerLongitudinal: number, segments = 32): NormalizedPitchPoint[] {
  const points: NormalizedPitchPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      lateral: centerLateral + Math.sin(angle) * CIRCLE_R_LATERAL_FRAC,
      longitudinal: centerLongitudinal + Math.cos(angle) * CIRCLE_R_LONGITUDINAL_FRAC,
    });
  }
  return points;
}

function toSvgPolyline(points: { xPct: number; yPct: number }[]): string {
  return points.map((p) => `${p.xPct.toFixed(2)},${p.yPct.toFixed(2)}`).join(" ");
}

/**
 * `TouchlinePlanningPitch`'s markings: subtle-perspective, trapezoid-aware (contract §3/§5 —
 * "Pitch markings must follow the same trapezoid"). Every line/box corner is projected through
 * `projectPlanningPitchPoint`, so the trapezoid is a real, consistent geometric projection, not a
 * CSS transform layered on top of a rectangular SVG.
 */
export function PlanningPitchMarkings() {
  const outline: NormalizedPitchPoint[] = [
    { lateral: 0, longitudinal: 0 },
    { lateral: 1, longitudinal: 0 },
    { lateral: 1, longitudinal: 1 },
    { lateral: 0, longitudinal: 1 },
  ];
  const outlineProjected = outline.map(projectPlanningPitchPoint);

  const halfway = [
    projectPlanningPitchPoint({ lateral: 0, longitudinal: 0.5 }),
    projectPlanningPitchPoint({ lateral: 1, longitudinal: 0.5 }),
  ];

  const centerSpot = projectPlanningPitchPoint({ lateral: 0.5, longitudinal: 0.5 });
  const centerCircle = circlePoints(0.5, 0.5).map(projectPlanningPitchPoint);

  const boxes = [0, 1].map((end) => {
    // end 0 = own goal (longitudinal 0), end 1 = attacking goal (longitudinal 1)
    const dir = end === 0 ? 1 : -1;
    const penaltyArea = [
      { lateral: 0.5 - PA_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + PA_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + PA_HALF_WIDTH_FRAC, longitudinal: end + dir * PA_DEPTH_FRAC },
      { lateral: 0.5 - PA_HALF_WIDTH_FRAC, longitudinal: end + dir * PA_DEPTH_FRAC },
    ].map(projectPlanningPitchPoint);
    const goalArea = [
      { lateral: 0.5 - GA_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + GA_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + GA_HALF_WIDTH_FRAC, longitudinal: end + dir * GA_DEPTH_FRAC },
      { lateral: 0.5 - GA_HALF_WIDTH_FRAC, longitudinal: end + dir * GA_DEPTH_FRAC },
    ].map(projectPlanningPitchPoint);
    const spot = projectPlanningPitchPoint({ lateral: 0.5, longitudinal: end + dir * SPOT_FRAC });
    const goalMouth = [
      { lateral: 0.5 - GOAL_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + GOAL_HALF_WIDTH_FRAC, longitudinal: end },
    ].map(projectPlanningPitchPoint);
    return { penaltyArea, goalArea, spot, goalMouth };
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon
        points={toSvgPolyline(outlineProjected)}
        fill="none"
        stroke="var(--tl-pitch-line)"
        strokeWidth="0.4"
      />
      <polyline points={toSvgPolyline(halfway)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <polygon points={toSvgPolyline(centerCircle)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx={centerSpot.xPct} cy={centerSpot.yPct} r="0.5" fill="var(--tl-pitch-line)" />
      {boxes.map((box, i) => (
        <g key={i}>
          <polygon points={toSvgPolyline(box.penaltyArea)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
          <polygon points={toSvgPolyline(box.goalArea)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.2" />
          <circle cx={box.spot.xPct} cy={box.spot.yPct} r="0.5" fill="var(--tl-pitch-line)" />
          <polyline points={toSvgPolyline(box.goalMouth)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.6" />
        </g>
      ))}
    </svg>
  );
}

/**
 * `TouchlinePositionMap`'s markings: flat, top-down, no perspective (contract §7). Reuses the
 * exact same normalized marking geometry above via `projectFlatPitchPoint`, so the two canonical
 * renderers describe one pitch, not two independently-tuned drawings — only the projection
 * function differs, per `06_CANONICAL_PITCH_RENDERING_CONTRACT.md §1` ("do not share
 * route-specific pitch markup" is about routes, not about the two canonical renderers sharing
 * this one geometry source).
 */
export function FlatPitchMarkings() {
  const outline: NormalizedPitchPoint[] = [
    { lateral: 0, longitudinal: 0 },
    { lateral: 1, longitudinal: 0 },
    { lateral: 1, longitudinal: 1 },
    { lateral: 0, longitudinal: 1 },
  ];
  const outlineProjected = outline.map(projectFlatPitchPoint);
  const halfway = [
    projectFlatPitchPoint({ lateral: 0, longitudinal: 0.5 }),
    projectFlatPitchPoint({ lateral: 1, longitudinal: 0.5 }),
  ];
  const centerCircle = circlePoints(0.5, 0.5).map(projectFlatPitchPoint);
  const centerSpot = projectFlatPitchPoint({ lateral: 0.5, longitudinal: 0.5 });

  const boxes = [0, 1].map((end) => {
    const dir = end === 0 ? 1 : -1;
    const penaltyArea = [
      { lateral: 0.5 - PA_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + PA_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + PA_HALF_WIDTH_FRAC, longitudinal: end + dir * PA_DEPTH_FRAC },
      { lateral: 0.5 - PA_HALF_WIDTH_FRAC, longitudinal: end + dir * PA_DEPTH_FRAC },
    ].map(projectFlatPitchPoint);
    const goalMouth = [
      { lateral: 0.5 - GOAL_HALF_WIDTH_FRAC, longitudinal: end },
      { lateral: 0.5 + GOAL_HALF_WIDTH_FRAC, longitudinal: end },
    ].map(projectFlatPitchPoint);
    return { penaltyArea, goalMouth };
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={toSvgPolyline(outlineProjected)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.4" />
      <polyline points={toSvgPolyline(halfway)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <polygon points={toSvgPolyline(centerCircle)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx={centerSpot.xPct} cy={centerSpot.yPct} r="0.5" fill="var(--tl-pitch-line)" />
      {boxes.map((box, i) => (
        <g key={i}>
          <polygon points={toSvgPolyline(box.penaltyArea)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
          <polyline points={toSvgPolyline(box.goalMouth)} fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.6" />
        </g>
      ))}
    </svg>
  );
}
