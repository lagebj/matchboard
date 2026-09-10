/**
 * TouchlineMark — the canonical Matchboard mark (ADR-0134 §2, bundle §18).
 *
 * The mark is unchanged: a monochrome single-path trace rendered as a CSS mask
 * so it inherits `currentColor`. No redesign, no new logo — colour/typography/
 * composition carry the visual reset, not the mark.
 */
type TouchlineMarkProps = {
  className?: string;
  title?: string;
};

export function TouchlineMark({ className, title }: TouchlineMarkProps) {
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={[
        "inline-block shrink-0 bg-current",
        "[mask-image:url('/brand/logo.svg')]",
        "[mask-position:center]",
        "[mask-repeat:no-repeat]",
        "[mask-size:contain]",
        "[-webkit-mask-image:url('/brand/logo.svg')]",
        "[-webkit-mask-position:center]",
        "[-webkit-mask-repeat:no-repeat]",
        "[-webkit-mask-size:contain]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
