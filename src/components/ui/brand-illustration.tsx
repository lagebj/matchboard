import { cn } from "@/lib/cn";
import { brandIllustrations } from "@/lib/brand-illustrations";

type BrandIllustrationKey = keyof typeof brandIllustrations;

type BrandIllustrationProps = {
  name: BrandIllustrationKey;
  alt?: string;
  decorative?: boolean;
  className?: string;
};

export function BrandIllustration({
  name,
  alt = "",
  decorative = true,
  className,
}: BrandIllustrationProps) {
  const illustration = brandIllustrations[name];
  const resolvedAlt = decorative ? "" : (alt || illustration.alt);
  const lightSrc = illustration.light;
  const darkSrc = illustration.dark;

  // <picture> lets the browser fetch only the variant it actually needs
  // (native media-query negotiation) instead of two <img> tags where the
  // "hidden" one still triggers a real network request — a well-known
  // performance pitfall for light/dark image swaps.
  return (
    <picture>
      <source srcSet={darkSrc} media="(prefers-color-scheme: dark)" />
      <img
        src={lightSrc}
        alt={resolvedAlt}
        aria-hidden={decorative}
        loading="lazy"
        decoding="async"
        className={className}
      />
    </picture>
  );
}

export function BrandIllustrationBackground({
  name,
  className,
}: {
  name: "subtleReportSketch";
  className?: string;
}) {
  const illustration = brandIllustrations[name];

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-right-bottom bg-no-repeat opacity-60 dark:hidden",
          className,
        )}
        style={{ backgroundImage: `url(${illustration.backgroundLight})` }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 hidden bg-right-bottom bg-no-repeat opacity-50 dark:block",
          className,
        )}
        style={{ backgroundImage: `url(${illustration.backgroundDark})` }}
      />
    </>
  );
}