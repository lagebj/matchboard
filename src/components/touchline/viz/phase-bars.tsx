/**
 * PhaseBars (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`).
 *
 * Match phases (opening/middle/closing) — this is the exact same concept the first Touchline
 * pass already built as `PhaseDistribution` (`src/components/touchline/evidence/
 * phase-distribution.tsx`). Re-exported under this name rather than duplicated, so the Design
 * Atlas's expected `viz/phase-bars.tsx` file exists without a second implementation.
 */
export { PhaseDistribution as PhaseBars } from "@/components/touchline/evidence/phase-distribution";
export type { PhaseSegment } from "@/components/touchline/evidence/phase-distribution";
