import { RatingSummary, overallToStarValue } from "@/lib/ratings/player-rating";

function StarDisplay({ overallValue }: { overallValue: number | null }) {
  if (overallValue === null) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  const starValue = overallToStarValue(overallValue);
  const maxStars = 5;
  const stars = [];

  for (let i = 1; i <= maxStars; i++) {
    if (i <= Math.floor(starValue)) {
      stars.push(
        <span key={i} className="text-amber-400" aria-hidden="true">★</span>,
      );
    } else if (i === Math.ceil(starValue) && starValue % 1 >= 0.25) {
      stars.push(
        <span key={i} className="text-amber-400" aria-hidden="true">★</span>,
      );
    } else {
      stars.push(
        <span key={i} className="text-[var(--text-muted)]" aria-hidden="true">☆</span>,
      );
    }
  }

  return <span className="inline-flex items-center gap-px text-xs leading-none">{stars}</span>;
}

export function RatingBadge({ rating }: { rating: RatingSummary }) {
  if (rating.value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]" title="Not rated">
        <StarDisplay overallValue={null} />
        <span>Not rated</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={`${rating.displayValue} (${rating.ratedAttributeCount}/${rating.maxAttributeCount} attributes)`}
    >
      <StarDisplay overallValue={rating.value} />
      <span className="tabular-nums text-zinc-200">{rating.displayValue}</span>
    </span>
  );
}

export function CompactRating({ rating }: { rating: RatingSummary }) {
  if (rating.value === null) {
    return (
      <span className="text-[var(--text-muted)] text-xs" title="Not rated">—</span>
    );
  }

  return (
    <span
      className="tabular-nums text-xs text-zinc-200"
      title={`${rating.displayValue} (${rating.ratedAttributeCount}/${rating.maxAttributeCount} attributes)`}
    >
      {rating.displayValue}
    </span>
  );
}