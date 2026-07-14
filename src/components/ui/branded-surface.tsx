import { cn } from "@/lib/cn";
import { BrandIllustration } from "@/components/ui/brand-illustration";
import type { BrandIllustrationKey } from "@/lib/brand-illustrations";

type BrandedSurfaceVariant = "plain" | "soft" | "hero" | "compact";

type BrandedSurfaceProps = {
  children: React.ReactNode;
  illustration?: {
    name: BrandIllustrationKey;
    alt?: string;
  };
  variant?: BrandedSurfaceVariant;
  className?: string;
};

const variantClasses: Record<BrandedSurfaceVariant, string> = {
  plain: "bg-[var(--surface-base)] border border-[var(--border-soft)]",
  soft: "bg-[var(--surface-muted)]/30 border border-[var(--border-soft)]",
  hero: "bg-[var(--surface-base)] border border-[var(--border-soft)]",
  compact: "bg-[var(--surface-base)] border border-[var(--border-soft)]",
};

export function BrandedSurface({
  children,
  illustration,
  variant = "plain",
  className,
}: BrandedSurfaceProps) {
  if (!illustration) {
    return (
      <div className={cn("rounded-xl", variantClasses[variant], className)}>
        {children}
      </div>
    );
  }

  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl",
        variantClasses[variant],
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none shrink-0",
          isHero
            ? "absolute right-0 top-0 bottom-0 w-32 md:w-48 flex items-center justify-end pr-4 md:pr-6 opacity-80 dark:opacity-70"
            : "absolute right-2 top-2 bottom-2 w-20 md:w-28 flex items-center justify-end opacity-60 dark:opacity-50",
        )}
        aria-hidden="true"
      >
        <BrandIllustration
          name={illustration.name}
          alt={illustration.alt ?? ""}
          decorative
          className={cn(
            "h-full w-auto object-contain object-right",
            isHero ? "max-h-32 md:max-h-44" : "max-h-20 md:max-h-28",
          )}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}