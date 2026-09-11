import { cn } from "@/lib/cn";
import { TouchlineMark } from "./touchline-mark";

/**
 * TouchlineBrandTile (Touchline Finish & Visual Convergence follow-up,
 * `03_CODE_CHANGE_MAP.md §C`) — a compact identity tile: the existing
 * `TouchlineMark` (unchanged geometry) on a dark tile background, in both
 * themes. Used only in the desktop wordmark lockup and the sign-in shell —
 * not the bright launcher/PWA treatment (`09_PWA_FAVICON_AND_BRAND_ASSETS.md`
 * reserves that accent-field tile for install surfaces only).
 */
type Props = {
  size?: number;
  className?: string;
};

export function TouchlineBrandTile({ size = 30, className }: Props) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[8px] bg-[#0c1a10]",
        className,
      )}
    >
      <TouchlineMark className="h-[58%] w-[58%] text-[var(--accent)]" />
    </span>
  );
}
