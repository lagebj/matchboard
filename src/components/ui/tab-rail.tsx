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
};

export function TabRail<TKey extends string>({
  items,
  activeKey,
  onSelect,
  variant = "underline",
  ariaLabel = "Tabs",
  className = "",
}: TabRailProps<TKey>) {
  if (variant === "pill") {
    return (
      <nav
        aria-label={ariaLabel}
        className={[
          "inline-flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 p-1",
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
          const classes = `inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 ${
            isActive
              ? "bg-[var(--accent-subtle)] text-zinc-50"
              : "text-[var(--text-muted)] hover:text-zinc-100 hover:bg-[var(--surface-hover)]/40"
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
        const classes = `shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 ${
          isActive
            ? "border-[var(--accent-strong)] text-zinc-50"
            : "border-transparent text-[var(--text-muted)] hover:text-zinc-100 hover:border-[var(--border-strong)]"
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
