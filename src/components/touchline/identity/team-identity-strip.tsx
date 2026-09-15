import { cn } from "@/lib/cn";
import { resolveKitColorSwatch } from "@/lib/teams/kit-color";

/**
 * TeamIdentityStrip — League Operating Surface (`05_TEAM_KIT_IDENTITY_STRIP.md`).
 *
 * A narrow vertical accent beside a team row that carries the existing configured
 * `Team.kitColor` — TEAM IDENTITY ONLY. It never encodes readiness, blocker severity,
 * win/loss/draw, current/selected state, or home/away; those states use their own
 * icon/text/status treatment elsewhere in the row. Colour is never inferred from a team's name
 * (e.g. "Rød", "Hvit", "Blå") — only the resolved `resolveKitColorSwatch()` hex is used.
 *
 * Decorative (`aria-hidden="true"`) — the team name remains the accessible identity and no
 * information is encoded only by colour.
 */
export type TeamIdentityStripProps = {
  /** The team's configured `Team.kitColor` value (e.g. `"RED"`), or `null`/unset. */
  kitColor: string | null | undefined;
  className?: string;
};

export function TeamIdentityStrip({ kitColor, className }: TeamIdentityStripProps) {
  const swatch = resolveKitColorSwatch(kitColor);
  const hex = swatch?.hex ?? null;

  // BLACK in dark theme and WHITE in light theme are both real-but-low-contrast fills against
  // this app's own surface tones. A subtle theme-aware hairline makes the strip visible without
  // altering the canonical configured kit hex (05§"Contrast edge cases").
  const needsOutline = swatch?.id === "BLACK" || swatch?.id === "WHITE";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-full w-[3px] shrink-0 rounded-full medium:w-[4px]",
        !hex && "bg-[var(--tl-widget-border)]",
        needsOutline && "outline outline-1 outline-[var(--border-soft)] -outline-offset-1",
        className,
      )}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}
