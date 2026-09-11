/**
 * RangeBand — re-exported for discoverability under `touchline/viz/` (Touchline Design Atlas
 * `04_WIDGET_COMPONENT_CONTRACTS.md §3`). The real implementation is the pre-existing ADR-0125
 * primitive at `src/components/viz/range-band.tsx` — not duplicated. Only use with a real
 * canonical baseline range and a `sampleContext` naming its source (see that file's own doc
 * comment).
 */
export { RangeBand } from "@/components/viz/range-band";
export type { RangeBandProps } from "@/components/viz/range-band";
