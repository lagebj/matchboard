import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * ScorebookRoundSection (bundle `06_MATCH_AND_SCOREBOOK_GRAMMAR.md §9`,
 * `12_COMPONENT_CONTRACTS.md §4`).
 *
 * A League round is a scorebook *section*, not a card. Header: the round marker
 * in Barlow Condensed (`W34`), date/period in Geist metadata, a state summary
 * (`Final · 3 matches`), and the round-board action near the header — not at the
 * far edge of a full-width container. No giant outer round card, no outer
 * border.
 */
type Props = {
  /** Canonical round label, e.g. "W34". */
  marker: string;
  /** e.g. "24 Aug". */
  dateLabel?: string;
  /** e.g. "Final · 3 matches" or "Planning · 2 decisions". */
  summary: string;
  boardHref?: string;
  /** Visible link text on expanded viewports (compact always shows "Board"). */
  boardLabel?: string;
  /** Accessible name for the board link, when it should differ from the visible text. */
  boardAriaLabel?: string;
  children: ReactNode;
  className?: string;
};

export function ScorebookRoundSection({
  marker,
  dateLabel,
  summary,
  boardHref,
  boardLabel = "Round board",
  boardAriaLabel,
  children,
  className,
}: Props) {
  return (
    <section className={cn("pt-6 first:pt-0", className)}>
      <div className="flex items-baseline gap-4">
        <h2 className="tl-round-marker text-[var(--foreground)]">{marker}</h2>
        {dateLabel ? (
          <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            {dateLabel}
          </span>
        ) : null}
        <span className="text-[13px] text-[var(--text-muted)]">{summary}</span>
        {boardHref ? (
          <Link
            href={boardHref}
            aria-label={boardAriaLabel}
            className="ml-auto shrink-0 text-[13px] font-medium text-[var(--text-soft)] no-underline hover:text-[var(--foreground)]"
          >
            <span className="medium:hidden">Board</span>
            <span className="hidden medium:inline">{boardLabel}</span>{" "}
            <span aria-hidden="true">›</span>
          </Link>
        ) : null}
      </div>
      <div className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
        {children}
      </div>
    </section>
  );
}
