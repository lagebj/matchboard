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

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative illustration with light/dark toggle */}
      <img
        src={lightSrc}
        alt={resolvedAlt}
        aria-hidden={decorative}
        className={cn("dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative illustration with light/dark toggle */}
      <img
        src={darkSrc}
        alt={resolvedAlt}
        aria-hidden={decorative}
        className={cn("hidden dark:block", className)}
      />
    </>
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