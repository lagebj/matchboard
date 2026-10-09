/**
 * Flat (non-perspective) pitch outline for the A06 profile analysis map candidate. Deliberately
 * NOT `PlanningPitchMarkings` — that shared component bakes in the trapezoid perspective
 * projection (`projection.ts`'s `projectPlanningPitchPoint`) that both production pitch renderers
 * use. This is an isolated, dev-only, orthogonal rectangle so the two A06 panels visibly differ
 * in projection, not just in dot placement (BLK-02, `24_CONFLICT_AND_BLOCKER_REGISTER.md`).
 */
export function FlatProfilePitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.4" />
      <line x1="2" y1="50" x2="98" y2="50" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <circle cx="50" cy="50" r="9" fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <rect x="30" y="2" width="40" height="14" fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
      <rect x="30" y="84" width="40" height="14" fill="none" stroke="var(--tl-pitch-line)" strokeWidth="0.3" />
    </svg>
  );
}
