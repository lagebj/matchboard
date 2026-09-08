/**
 * Shared helpers for the Matchboard evidence-visualization primitives (ADR-0124 §16,
 * docs/product/adaptive-interaction-design.md §13).
 *
 * Rules these primitives all follow:
 *  - native SVG/CSS/React only — no chart library;
 *  - every primitive answers one concrete question and takes a required `question` prop;
 *  - every primitive renders a visually-hidden text equivalent (screen readers, zoom);
 *  - colour is never the only signal, and there is no good/bad / red-green encoding;
 *  - no ranking, no composite score, no causal wording;
 *  - legible at 360px.
 */

/**
 * Distinct, non-judgemental categorical hues drawn from the existing token palette. These
 * separate categories from one another — they do NOT encode "good" or "bad". Order is stable so
 * the same category keeps the same colour across renders.
 */
export const VIZ_CATEGORY_COLORS = [
  "var(--accent)",
  "var(--info)",
  "var(--dev)",
  "var(--warning)",
  "var(--text-muted)",
  "var(--accent-strong)",
] as const;

export function vizColorAt(index: number): string {
  return VIZ_CATEGORY_COLORS[index % VIZ_CATEGORY_COLORS.length];
}

export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function formatPct(value: number, total: number): string {
  return `${Math.round(pct(value, total))}%`;
}

/** Neutral direction word for a numeric change — never "better"/"worse". */
export function directionWord(delta: number): "up" | "down" | "unchanged" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "unchanged";
}

export function directionGlyph(delta: number): string {
  if (delta > 0) return "▲";
  if (delta < 0) return "▼";
  return "–";
}

/** Where a value sits relative to a supplied historical range. Neutral, not evaluative. */
export function rangePosition(
  value: number,
  low: number,
  high: number,
): "below range" | "within range" | "above range" {
  if (value < low) return "below range";
  if (value > high) return "above range";
  return "within range";
}
