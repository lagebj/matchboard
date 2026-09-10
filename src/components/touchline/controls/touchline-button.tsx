import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlineButton (ADR-0134 §16 / bundle `12_COMPONENT_CONTRACTS.md §16`).
 *
 * One dominant `primary` action per active operational context — accent fill
 * (`#C7F54A` + `#101500` text in dark; `#587400` + white in light). `secondary`
 * is the calm default; `ghost` for quiet inline actions; `danger` for
 * destructive. 8 px control radius — never a full pill.
 */
export type TouchlineButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type TouchlineButtonSize = "sm" | "md" | "lg";

type OwnProps<As extends ElementType> = {
  as?: As;
  variant?: TouchlineButtonVariant;
  size?: TouchlineButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

type Props<As extends ElementType> = OwnProps<As> &
  Omit<ComponentPropsWithoutRef<As>, keyof OwnProps<As>>;

const sizeClasses: Record<TouchlineButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-[14px] gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

const variantClasses: Record<TouchlineButtonVariant, string> = {
  primary:
    "bg-[var(--tl-c-accent)] text-[var(--tl-c-accent-on-fill)] font-semibold " +
    "hover:brightness-105 active:brightness-95",
  secondary:
    "bg-[var(--tl-c-surface-strong)] text-[var(--foreground)] border border-[var(--border-soft)] " +
    "hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-soft)] border border-transparent " +
    "hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]",
  danger:
    "bg-[var(--danger-subtle)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] " +
    "hover:border-[var(--danger)]",
};

const base =
  "inline-flex items-center justify-center rounded-[var(--tl-c-radius-control)] font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,color,filter] duration-[var(--tl-c-motion-state)] ease-[var(--tl-c-motion-ease)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function TouchlineButton<As extends ElementType = "button">(props: Props<As>) {
  const {
    as,
    variant = "secondary",
    size = "md",
    leadingIcon,
    trailingIcon,
    fullWidth,
    className,
    children,
    ...rest
  } = props as OwnProps<As> & Record<string, unknown>;

  const Tag = (as ?? "button") as ElementType;
  const tagProps: Record<string, unknown> =
    Tag === "button" ? { type: (rest as { type?: string }).type ?? "button" } : {};

  return (
    <Tag
      {...tagProps}
      className={cn(base, sizeClasses[size], variantClasses[variant], fullWidth && "w-full", className)}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </Tag>
  );
}
