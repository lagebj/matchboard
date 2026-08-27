import { roundToNearestHalfStar } from "@/lib/ratings/player-rating";

const MAX_STARS = 5;

/**
 * The single shared star-icon renderer for player ratings. Converts a raw 1-10 attribute rating
 * to a 0-5 star display via the centralized `roundToNearestHalfStar()` — never re-derive the
 * conversion locally (a prior duplicate treated the 1-10 value as already being on the 0-5 scale,
 * showing a 5.6 average as five stars). Half stars render as a genuinely half-filled glyph, not
 * rounded up to a full star.
 */
export function StarRating({
  overallValue,
  className = "",
}: {
  /** Raw 1-10 attribute rating, or null when unrated. */
  overallValue: number | null;
  className?: string;
}) {
  if (overallValue === null) {
    return (
      <span className={`text-[var(--text-muted)] ${className}`.trim()} aria-hidden="true">
        —
      </span>
    );
  }

  const starValue = roundToNearestHalfStar(overallValue);
  const fullStars = Math.floor(starValue);
  const hasHalfStar = starValue % 1 !== 0;

  const stars = [];
  for (let i = 1; i <= MAX_STARS; i++) {
    if (i <= fullStars) {
      stars.push(
        <span key={i} className="text-amber-400" aria-hidden="true">★</span>,
      );
    } else if (hasHalfStar && i === fullStars + 1) {
      stars.push(
        <span key={i} className="relative inline-block" aria-hidden="true">
          <span className="text-[var(--text-muted)]">★</span>
          <span className="absolute inset-0 w-1/2 overflow-hidden text-amber-400">★</span>
        </span>,
      );
    } else {
      stars.push(
        <span key={i} className="text-[var(--text-muted)]" aria-hidden="true">☆</span>,
      );
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-px leading-none ${className}`.trim()}
      role="img"
      aria-label={`${starValue} out of 5 stars`}
    >
      {stars}
    </span>
  );
}
