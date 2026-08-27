import { RatingSummary } from "@/lib/ratings/player-rating";
import { StarRating } from "@/components/ratings/star-rating";

export function RatingBadge({ rating }: { rating: RatingSummary }) {
  if (rating.value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]" title="Not rated">
        <StarRating overallValue={null} className="text-xs" />
        <span>Not rated</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={`${rating.displayValue} (${rating.ratedAttributeCount}/${rating.maxAttributeCount} attributes)`}
    >
      <StarRating overallValue={rating.value} className="text-xs" />
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