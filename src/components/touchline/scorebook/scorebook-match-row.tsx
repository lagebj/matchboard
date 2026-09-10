import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  type MatchPresentation,
  matchPresentationPhase,
  primaryAttention,
} from "@/lib/matches/match-presentation";

/**
 * ScorebookMatchRow (bundle `06_MATCH_AND_SCOREBOOK_GRAMMAR.md §4`,
 * `12_COMPONENT_CONTRACTS.md §5`).
 *
 * A dense, divider-only scorebook row — no outer card, no per-row shadow. Home
 * then away, aligned. The own team gets stronger weight + a 2 px accent marker
 * on its line — never a full accent fill, never reordered to the front. Score
 * is Barlow Condensed, right-aligned in a stable value lane, neutral
 * foreground; the winning value carries slightly more weight and the losing
 * value slightly less — weight, not colour. A loss is never red; a win is never
 * green. Metadata (`FT · Win`, own-team perspective) sits quiet to the right of
 * the value lane.
 *
 * Every domain fact comes from the canonical `MatchPresentation`; this row
 * never re-derives home/away, orientation, lifecycle, outcome, clock, or
 * cancellation.
 */
type Props = {
  presentation: MatchPresentation;
  href?: string;
  className?: string;
};

type LineWeight = "strong" | "normal" | "soft";

function TeamScoreLine({
  name,
  isOwn,
  value,
  valueIsDate,
  weight,
}: {
  name: string;
  isOwn: boolean;
  value: string;
  valueIsDate: boolean;
  weight: LineWeight;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "h-[18px] w-[2px] shrink-0 rounded-full",
          isOwn ? "bg-[var(--accent)]" : "bg-transparent",
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[16px]",
          isOwn ? "font-[600] text-[var(--foreground)]" : "font-normal text-[var(--text-soft)]",
        )}
      >
        {name}
      </span>
      {valueIsDate ? (
        <span className="shrink-0 text-[13px] tabular-nums text-[var(--text-muted)]">{value}</span>
      ) : (
        <span
          className={cn(
            "tl-score-list w-[2.75rem] shrink-0 text-right",
            weight === "strong" && "text-[var(--foreground)]",
            weight === "normal" && "text-[var(--foreground)]",
            weight === "soft" && "font-[600] text-[var(--text-muted)]",
          )}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export function ScorebookMatchRow({ presentation: p, href, className }: Props) {
  const phase = matchPresentationPhase(p);
  const attention = primaryAttention(p);
  const target = href ?? p.href ?? undefined;

  const scheduled = phase === "scheduled";
  const cancelled = phase === "cancelled";
  const final = phase === "final";
  const live = phase === "live";

  const homeValue = scheduled
    ? (p.kickoffTime ?? "—")
    : cancelled
      ? "—"
      : String(p.score?.home ?? "—");
  const awayValue = scheduled
    ? (p.kickoffDate ?? "")
    : cancelled
      ? "—"
      : String(p.score?.away ?? "—");

  const outcome = p.resultOutcomeForOwnTeam;
  const ownSide = p.ownTeamSide;
  function weightFor(side: "home" | "away"): LineWeight {
    if (!final || outcome === "unknown" || outcome === "draw" || ownSide == null) return "normal";
    const isOwnSide = side === ownSide;
    if (outcome === "win") return isOwnSide ? "strong" : "soft";
    return isOwnSide ? "soft" : "strong";
  }

  const outcomeShort =
    p.outcomeLabel === "WON" ? "Win" : p.outcomeLabel === "LOST" ? "Loss" : p.outcomeLabel === "DRAW" ? "Draw" : null;
  const outcomeAbbrev = outcomeShort ? outcomeShort[0] : null;

  const trailing = live ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--tl-c-live)]">
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--tl-c-live)]" aria-hidden="true" />
      LIVE{p.clockLabel ? ` · ${p.clockLabel}` : ""}
    </span>
  ) : final ? (
    <span className="text-[12px] text-[var(--text-muted)]">
      <span className="medium:hidden">
        FT{outcomeAbbrev ? ` · ${outcomeAbbrev}` : ""}
      </span>
      <span className="hidden medium:inline">
        FT{outcomeShort ? ` · ${outcomeShort}` : p.reportAttention ? ` · ${p.reportAttention.label}` : ""}
      </span>
    </span>
  ) : cancelled ? (
    <span className="text-[12px] text-[var(--text-muted)]">Cancelled</span>
  ) : attention ? (
    <span
      className={cn(
        "text-[12px] font-medium",
        attention.tone === "danger"
          ? "text-[var(--danger)]"
          : attention.tone === "warning"
            ? "text-[var(--warning)]"
            : "text-[var(--text-muted)]",
      )}
    >
      {attention.label}
    </span>
  ) : scheduled ? (
    <span className="text-[12px] text-[var(--text-muted)]">Scheduled</span>
  ) : null;

  const body = (
    <div className={cn("flex items-center gap-3 py-2.5", cancelled && "opacity-60", className)}>
      <div className="min-w-0 flex-1 space-y-1">
        <TeamScoreLine
          name={p.homeTeam}
          isOwn={ownSide === "home"}
          value={homeValue}
          valueIsDate={false}
          weight={weightFor("home")}
        />
        <TeamScoreLine
          name={p.awayTeam}
          isOwn={ownSide === "away"}
          value={awayValue}
          valueIsDate={scheduled}
          weight={weightFor("away")}
        />
      </div>
      {trailing ? (
        <div className="w-[4.5rem] shrink-0 text-left leading-tight">{trailing}</div>
      ) : null}
    </div>
  );

  if (target) {
    return (
      <Link
        href={target}
        className="-mx-2 block rounded-[var(--tl-c-radius-control)] px-2 no-underline transition-colors hover:bg-[var(--tl-c-surface-hover)]"
      >
        {body}
      </Link>
    );
  }
  return body;
}
