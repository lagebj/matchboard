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

  return (
    <div className={cn("flex items-center justify-center gap-6 sm:gap-10", className)}>
      <TeamIdentity name={p.homeTeam} accented={p.ownTeamSide === "home"} kitColor={p.ownTeamSide === "home" ? ownKitColor : null} size={kitSize} />
      <div className="flex flex-col items-center gap-1">
        <p className={cn("tl-sport font-[650] leading-none text-[var(--foreground)]", heroSize)}>{hero}</p>
        <p className={cn("text-[13px]", isLive ? "tl-clock text-[var(--tl-c-live)]" : "text-[var(--text-muted)]")}>
          {statusLine}
        </p>
      </div>
      <TeamIdentity name={p.awayTeam} accented={p.ownTeamSide === "away"} kitColor={p.ownTeamSide === "away" ? ownKitColor : null} size={kitSize} />
    </div>
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
