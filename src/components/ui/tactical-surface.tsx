"use client";

import { cn } from "@/lib/cn";
import type { ElementType, ReactNode } from "react";

/**
 * TacticalSurface — premium surface with optional pitch-line/grid treatment.
 *
 * Visual levels:
 *   default → base panel
 *   raised  → elevated card
 *   hero    → primary hero panel
 *   board   → tactical board column (slightly warmer)
 *   subtle  → muted inset
 */
export type TacticalSurfaceVariant =
  | "default"
  | "raised"
  | "hero"
  | "board"
  | "subtle";

export type TacticalSurfacePadding = "none" | "sm" | "md" | "lg";

type TacticalSurfaceOwnProps<As extends ElementType> = {
  as?: As;
  variant?: TacticalSurfaceVariant;
  padding?: TacticalSurfacePadding;
  pitch?: boolean;
  glow?: boolean;
  className?: string;
  children?: ReactNode;
};

type TacticalSurfaceProps<As extends ElementType> = TacticalSurfaceOwnProps<As> &
  Omit<React.ComponentPropsWithoutRef<As>, keyof TacticalSurfaceOwnProps<As>>;

const variantClasses: Record<TacticalSurfaceVariant, string> = {
  default:
    "bg-[var(--surface-base)] border border-[var(--border-soft)]",
  raised:
    "bg-[var(--surface-raised)] border border-[var(--border-strong)] shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.03)]",
  hero:
    "bg-[var(--surface-hero)] border border-[var(--border-strong)] shadow-[0_18px_50px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]",
  board:
    "bg-[var(--surface-tactical)] border border-[var(--border-pitch)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
  subtle:
    "bg-[var(--surface-muted)]/40 border border-transparent",
};

const paddingClasses: Record<TacticalSurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function TacticalSurface<As extends ElementType = "div">(
  props: TacticalSurfaceProps<As>,
) {
  const {
    as,
    variant = "default",
    padding = "none",
    pitch: _pitch = false,
    glow: _glow = false,
    className,
    children,
    ...rest
  } = props as TacticalSurfaceOwnProps<As> & Record<string, unknown>;
  const Tag = (as ?? "div") as ElementType;

  return (
    <Tag
      className={cn(
        "rounded-xl",
        variantClasses[variant],
        paddingClasses[padding],
        // `pitch` / `glow` are deprecated no-ops under Product Surface 1.0 (ADR-0130 §04:
        // solid canvas, no repeating pitch-line texture, no glows). Kept for API compatibility.
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}