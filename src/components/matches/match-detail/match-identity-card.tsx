import { cn } from "@/lib/cn";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import { matchPresentationPhase } from "@/lib/matches/match-presentation";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
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
 * Narrow-width correction, two parts (found independently of a direct B07 UI Lab candidate
 * review, confirmed pre-existing since at least B04/B06's own already-captured compact
 * screenshots):
 *
 * 1. (First pass) The score wrapped to two lines below ~430px.
 * 2. (This pass) The first pass's fix kept the score on one line by truncating team names down to
 *    a fixed `max-w-[4.5rem]` at compact widths — losing exactly the information that
 *    distinguishes two same-club teams (e.g. "Slemmestad Rød" → "Slemme…", indistinguishable from
 *    "Slemmestad Hvit"/"Slemmestad Blå" once truncated). Match identity must never be sacrificed
 *    for score compactness.
 *
 * Below the `medium` breakpoint (600px, this app's own documented "compact" shell tier,
 * `globals.css`'s "Adaptive shell breakpoints"), this renders a **completely separate
 * composition** from the `medium:`-and-up one below it — not the same DOM responsively
 * restyled — specifically so the `medium:`-and-up markup can stay byte-for-byte identical to the
 * original, pre-fix component (verified pixel-identical against real browser captures at
 * 600/768/900/1440px). Both are always in the DOM; exactly one is ever visible at a time via
 * `medium:hidden` / `hidden medium:flex`, same technique already used for the two `TeamKitMark`
 * size instances below.
 *
 * The compact composition is a 2-row grid instead of 1-row flex: row 1 is
 * `[home kit] [score] [away kit]`, row 2 is `[home name] [status] [away name]`. Team names no
 * longer share horizontal room with the score at all, so each name column gets roughly half the
 * card's width — comfortably enough for real Matchboard team names (including same-club pairs
 * like "Slemmestad Rød"/"Slemmestad Hvit") to render in full, wrapping onto a second line rather
 * than being cut off if a name genuinely doesn't fit one line at the narrowest supported width. A
 * `line-clamp-2` is the final fallback for the rare pathologically long name, not a routine
 * truncation path.
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
  const heroSize = size === "lg" ? "text-[40px]" : "text-[32px]";
  const homeHex = resolveKitColorSwatch(p.ownTeamSide === "home" ? ownKitColor : null)?.hex ?? null;
  const awayHex = resolveKitColorSwatch(p.ownTeamSide === "away" ? ownKitColor : null)?.hex ?? null;
  const homeAccented = p.ownTeamSide === "home";
  const awayAccented = p.ownTeamSide === "away";
  const statusClassName = cn("text-[13px]", isLive ? "tl-clock text-[var(--tl-c-live)]" : "text-[var(--text-muted)]");

  return (
    <>
      {/* Compact (<600px): see the module doc comment. */}
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 medium:hidden",
          className,
        )}
      >
        <TeamKitMark color={homeHex} size="sm" ariaLabel={`${p.homeTeam} kit`} className="justify-self-center" />
        <p className={cn("tl-sport whitespace-nowrap text-center font-[650] leading-none text-[var(--foreground)]", heroSize)}>
          {hero}
        </p>
        <TeamKitMark color={awayHex} size="sm" ariaLabel={`${p.awayTeam} kit`} className="justify-self-center" />
        <p className={cn("line-clamp-2 text-center text-[13px] font-[600] leading-tight", homeAccented ? "text-[var(--accent)]" : "text-[var(--text-soft)]")}>
          {p.homeTeam}
        </p>
        <p className={cn(statusClassName, "text-center text-[11px]")}>{statusLine}</p>
        <p className={cn("line-clamp-2 text-center text-[13px] font-[600] leading-tight", awayAccented ? "text-[var(--accent)]" : "text-[var(--text-soft)]")}>
          {p.awayTeam}
        </p>
      </div>

      {/* medium+ (600px and up): the original, unmodified single-row composition. */}
      <div className={cn("hidden items-center justify-center gap-6 medium:flex sm:gap-10", className)}>
        <TeamIdentity name={p.homeTeam} accented={homeAccented} kitColor={p.ownTeamSide === "home" ? ownKitColor : null} size={kitSize} />
        <div className="flex flex-col items-center gap-1">
          <p className={cn("tl-sport font-[650] leading-none text-[var(--foreground)]", heroSize)}>{hero}</p>
          <p className={statusClassName}>{statusLine}</p>
        </div>
        <TeamIdentity name={p.awayTeam} accented={awayAccented} kitColor={p.ownTeamSide === "away" ? ownKitColor : null} size={kitSize} />
      </div>
    </>
  );
}

function TeamIdentity({
  name,
  accented,
  kitColor,
  size,
}: {
  name: string;
  accented: boolean;
  /** Raw `Team.kitColor` id (e.g. `"RED"`) — resolved to a CSS hex here, not by the caller. */
  kitColor: string | null;
  size: "md" | "lg";
}) {
  const resolvedHex = resolveKitColorSwatch(kitColor)?.hex ?? null;
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamKitMark color={resolvedHex} size={size} ariaLabel={`${name} kit`} />
      <span
        className={cn(
          "max-w-[9rem] truncate text-[14px] font-[600] sm:max-w-[12rem]",
          accented ? "text-[var(--accent)]" : "text-[var(--text-soft)]",
        )}
      >
        {name}
      </span>
    </div>
  );
}
