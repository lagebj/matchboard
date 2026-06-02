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
    pitch = false,
    glow = false,
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
        pitch &&
          "relative overflow-hidden before:absolute before:inset-0 before:pointer-events-none before:bg-[repeating-linear-gradient(180deg,transparent_0px,transparent_39px,rgba(140,167,146,0.025)_39px,rgba(140,167,146,0.025)_40px)]",
        glow &&
          "absolute -inset-px before:pointer-events-none before:rounded-xl before:bg-[radial-gradient(ellipse_at_50%_0%,rgba(140,167,146,0.03),transparent_60%)]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}