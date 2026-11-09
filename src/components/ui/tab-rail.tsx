"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * TabRail — unified tab pattern.
 *
 * Per ADR 0007: active tab is clear; inactive tabs quiet; tabs should not look
 * heavier than the page content. Default uses underline style (less chrome).
 * `pill` style is reserved for major mode switches (e.g., Match detail's
 * Squad/After match/Opponent context).
 */
export type TabItem<TKey extends string = string> = {
  key: TKey;
  label: string;
  /** Shorter label shown at compact widths only (e.g. "Groups" for "Manage base groups") — the
      underlying mode/key never changes, just the rendered text. Falls back to `label` when
      omitted, so every existing caller keeps its current rendering unchanged. */
  compactLabel?: string;
  icon?: ReactNode;
  href?: string;
  count?: number;
  disabled?: boolean;
};

type TabRailProps<TKey extends string> = {
  items: TabItem<TKey>[];
  activeKey: TKey;
  onSelect?: (key: TKey) => void;
  variant?: "underline" | "pill";
  ariaLabel?: string;
  className?: string;
  /** Hides the native horizontal-scroll scrollbar when the rail overflows its container — an
      opt-in, backwards-compatible capability (existing callers keep the native scrollbar unless
      they pass this). Scrolling itself, and reachability of every tab, is unaffected. */
  hideScrollbar?: boolean;
};

export function TabRail<TKey extends string>({
  items,
  activeKey,
  onSelect,
  variant = "underline",
  ariaLabel = "Tabs",
  className = "",
  hideScrollbar = false,
}: TabRailProps<TKey>) {
  if (variant === "pill") {
    return (
      <nav
        aria-label={ariaLabel}
        className={[
          // B08 W5 remediation (independent review, P1-4): `max-w-full` + `overflow-x-auto`
          // caps this rail at its own container's width and lets it scroll WITHIN its own
          // bounds once its tabs' combined content is wider than the viewport (a real,
          // pre-existing defect at narrow widths — unbounded `inline-flex` content simply blew
          // out the whole page's horizontal scroll). Both are additive to the existing
          // `inline-flex` shrink-to-fit sizing: a rail that already fits its container renders
          // byte-identical to before — it only ever activates once content would have
          // overflowed, which previously meant the whole page, not just this rail.
          "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-1",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const inner = (
            <span className="inline-flex items-center gap-1.5">
              {item.icon}
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-[10px] tabular-nums ${
                    isActive ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </span>
          );
          // `shrink-0` (P1-4): without it, a flex item's default `flex-shrink: 1` would let the
          // browser compress/wrap individual pill labels once `overflow-x-auto` above is
          // introduced, instead of letting the whole rail scroll cleanly — the same `shrink-0`
          // discipline the `underline` variant below already uses for exactly this reason.
          const classes = `inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 ${
            isActive
              ? "bg-[var(--accent-subtle)] text-[var(--foreground)]"
              : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]/40"
          } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`;
          if (item.href) {
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={classes}
              >
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={item.key}
              type="button"
              aria-current={isActive ? "page" : undefined}
              disabled={item.disabled}
              onClick={() => onSelect?.(item.key)}
              className={classes}
            >
              {inner}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={[
        "flex overflow-x-auto border-b border-[var(--border-soft)]",
        hideScrollbar && "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        const inner = (
          <span className="inline-flex items-center gap-1.5">
            {item.icon}
            <span className={item.compactLabel ? "hidden medium:inline" : undefined}>{item.label}</span>
            {item.compactLabel ? <span className="medium:hidden">{item.compactLabel}</span> : null}
            {item.count !== undefined && item.count > 0 && (
              <span
                className={`text-[10px] tabular-nums ${
                  isActive ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"
                }`}
              >
                {item.count}
              </span>
            )}
          </span>
        );
        const classes = `shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 ${
          isActive
            ? "border-[var(--accent-strong)] text-[var(--foreground)]"
            : "border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
        } ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}`;
        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={classes}
            >
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            aria-current={isActive ? "page" : undefined}
            disabled={item.disabled}
            onClick={() => onSelect?.(item.key)}
            className={classes}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
