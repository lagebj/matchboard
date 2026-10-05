/**
 * Thin re-export over the single canonical position-label authority (ADR-0154 §4/§18). This
 * module no longer maintains its own label dictionary -- `canonicalFullLabel`/
 * `canonicalCompactLabel` (`src/domain/positions/canonical-labels.ts`) cover the full 24-code
 * vocabulary plus broad/legacy fallback. Kept under this name/path for existing call sites.
 */
export { canonicalFullLabel as exactPositionLabel, canonicalCompactLabel as compactPositionLabel } from "@/domain/positions/canonical-labels";
