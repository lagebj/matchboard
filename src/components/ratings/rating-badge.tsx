import { RatingSummary } from "@/lib/ratings/player-rating";

function StarDisplay({ value, maxStars = 5 }: { value: number | null; maxStars?: number }) {
  if (value === null) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }

  const stars = [];
  const filled = Math.round(value);

  for (let i = 1; i <= maxStars; i++) {
    if (i <= filled) {
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
        <StarDisplay value={null} />
        <span>Not rated</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={`${rating.displayValue} (${rating.ratedAttributeCount}/${rating.maxAttributeCount} attributes)`}
    >
      <StarDisplay value={rating.value} />
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