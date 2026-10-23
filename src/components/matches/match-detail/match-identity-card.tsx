import { cn } from "@/lib/cn";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import { matchPresentationPhase } from "@/lib/matches/match-presentation";
import { TeamKitMark, type TeamKitMarkSize } from "@/components/touchline/identity/team-kit-mark";
import { resolveKitColorSwatch } from "@/lib/teams/kit-color";

/**
 * MatchIdentityCard — the large team-versus-opponent "result card" / "match identity block"
 * (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md` "Match identity block",
 * `04_MATCH_DETAILS_AFTER_MATCH_SPEC.md` "Result card"). Both canonical goldens
 * (`references/golden/source/*_CANONICAL.png`) place this as *content* — inside Match Details'
 * Overview tab, or at the top of the Post-Match Report page — never inside the persistent page
 * header, which is why this is its own component rather than a `MatchScoreHeader` variant.
 *
 * Reuses `buildMatchPresentation()`/`matchPresentationPhase()` for every orientation/score/phase
 * decision (never forks that logic). The only genuinely new ingredient the golden adds is the
 * jersey identity (`TeamKitMark`, Atlas Follow-up) in place of a photo — the opponent side has no
 * kit-colour data anywhere in the schema, so it always renders the neutral shirt, never a
 * fabricated colour.
 *
 * Deliberately does not show a fake `0-0` before kickoff — the hero shows an em dash until a real
 * score exists, matching the exact canonical golden (`references/golden/crops/
 * 03_match_details_before_planned_desktop.png`), which differs from `MatchScoreHeader`'s own
 * pre-match hero (kickoff time) — a disclosed, golden-driven composition, not a change to that
 * shared component or its other call sites.
 *
 * Narrow-width correction (found independently of a direct B07 UI Lab candidate review, confirmed
 * pre-existing since at least B04/B06's own already-captured compact screenshots): below the
 * `medium` breakpoint (600px, this app's own documented "compact" shell tier,
 * `globals.css`'s "Adaptive shell breakpoints"), the hero score now has `whitespace-nowrap` +
 * `shrink-0` (never wraps, never gets compressed below its own content width) and the layout
 * reclaims room for it four ways, every one of them scoped to strictly below `medium` (600px) and
 * reverting to the exact pre-existing values at `medium:`/`sm:` and up:
 * - A tighter `gap` only below `medium` (`gap-3`); the pre-existing `gap-6` value is preserved,
 *   unchanged, for the entire 600-639px range via an explicit `medium:gap-6` tier (640px's own
 *   `sm:gap-10` is untouched) — a 2-tier `gap-3 sm:gap-10` was tried first and rejected: it would
 *   have silently redefined 600-639px (previously `gap-6`, same as every width below 640) to the
 *   new tighter `gap-3` instead, a real, narrow, undisclosed desktop-adjacent regression this
 *   3-tier version avoids entirely.
 * - A tighter team-name truncation width only below `medium`; `medium:max-w-[9rem]` preserves the
 *   pre-existing 600-639px value exactly, same reasoning.
 * - A smaller `TeamKitMark` size only below `medium` — an existing, already-supported size
 *   variant, not a new one, two instances toggled by CSS display rather than a prop the component
 *   doesn't support making responsive on its own.
 * - `TeamIdentity`'s `flex-1` (letting the two team columns share any leftover row width, so the
 *   `shrink-0` score column is never the one asked to give up space) is itself `medium:flex-none`
 *   — scoped the same way, even though in every real call site today `MatchIdentityCard`'s own
 *   root element is never stretched by its parent (each wraps it in a plain
 *   `flex items-center justify-center` container with no `w-full`/grow on the child), so there is
 *   no leftover width for `flex-1` to redistribute there regardless of the breakpoint. Explicitly
 *   scoping it anyway removes any dependency on that caller-side fact holding forever, rather than
 *   relying on it implicitly.
 */
type Props = {
  presentation: MatchPresentation;
  ownKitColor?: string | null;
  size?: "md" | "lg";
  className?: string;
};

export function MatchIdentityCard({ presentation: p, ownKitColor = null, size = "md", className }: Props) {
  const phase = matchPresentationPhase(p);
  const isScheduled = phase === "scheduled";
  const isCancelled = phase === "cancelled";
  const isLive = phase === "live";

  const hero = isCancelled ? "—" : isScheduled ? "—" : p.score != null ? `${p.score.home} - ${p.score.away}` : "—";

  const statusLine = isLive
    ? (p.clockLabel ?? "LIVE")
    : isCancelled
      ? "Cancelled"
      : phase === "final"
        ? "FT"
        : [p.kickoffDate, p.kickoffTime].filter(Boolean).join(" · ") || "Scheduled";

  const kitSize = size === "lg" ? "lg" : "md";
  // Below `medium` (600px), an existing smaller size variant — not a new one — so the fixed-pixel
  // kit mark doesn't force the row past 320-430px's available width.
  const compactKitSize: TeamKitMarkSize = size === "lg" ? "md" : "sm";
  const heroSize = size === "lg" ? "text-[40px]" : "text-[32px]";

  return (
    <div className={cn("flex items-center justify-center gap-3 medium:gap-6 sm:gap-10", className)}>
      <TeamIdentity
        name={p.homeTeam}
        accented={p.ownTeamSide === "home"}
        kitColor={p.ownTeamSide === "home" ? ownKitColor : null}
        size={kitSize}
        compactSize={compactKitSize}
      />
      <div className="flex shrink-0 flex-col items-center gap-1">
        <p className={cn("tl-sport font-[650] leading-none whitespace-nowrap text-[var(--foreground)]", heroSize)}>{hero}</p>
        <p className={cn("text-[13px]", isLive ? "tl-clock text-[var(--tl-c-live)]" : "text-[var(--text-muted)]")}>
          {statusLine}
        </p>
      </div>
      <TeamIdentity
        name={p.awayTeam}
        accented={p.ownTeamSide === "away"}
        kitColor={p.ownTeamSide === "away" ? ownKitColor : null}
        size={kitSize}
        compactSize={compactKitSize}
      />
    </div>
  );
}

function TeamIdentity({
  name,
  accented,
  kitColor,
  size,
  compactSize,
}: {
  name: string;
  accented: boolean;
  /** Raw `Team.kitColor` id (e.g. `"RED"`) — resolved to a CSS hex here, not by the caller. */
  kitColor: string | null;
  size: "md" | "lg";
  /** Rendered below `medium` (600px) in place of `size` — see the module doc comment. */
  compactSize: TeamKitMarkSize;
}) {
  const resolvedHex = resolveKitColorSwatch(kitColor)?.hex ?? null;
  return (
    <div className="flex min-w-0 flex-1 medium:flex-none flex-col items-center gap-2 text-center">
      <TeamKitMark color={resolvedHex} size={compactSize} ariaLabel={`${name} kit`} className="medium:hidden" />
      <TeamKitMark color={resolvedHex} size={size} ariaLabel={`${name} kit`} className="hidden medium:inline-flex" />
      <span
        className={cn(
          "max-w-[4.5rem] truncate text-[14px] font-[600] medium:max-w-[9rem] sm:max-w-[12rem]",
          accented ? "text-[var(--accent)]" : "text-[var(--text-soft)]",
        )}
      >
        {name}
      </span>
    </div>
  );
}
