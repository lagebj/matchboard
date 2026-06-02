import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

/**
 * Button — single button primitive with calm variants.
 *
 * Per ADR 0007:
 * - `primary` is the page-region primary action (rare; one per region).
 * - `secondary` is the calm default for normal actions.
 * - `ghost` is for navigation and quiet links rendered as buttons.
 * - `danger` is for destructive (delete, clear).
 * - `warning` is for reopen / unfinalize / amber-significance actions.
 * - `quiet` is for inline icon/secondary buttons that should not draw attention.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "warning"
  | "quiet";

export type ButtonSize = "sm" | "md" | "lg";

type ButtonOwnProps<As extends ElementType> = {
  as?: As;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonProps<As extends ElementType> = ButtonOwnProps<As> &
  Omit<ComponentPropsWithoutRef<As>, keyof ButtonOwnProps<As>>;

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent-subtle)] text-[var(--accent-strong)] border border-[var(--accent)]/40 " +
    "hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] hover:border-[var(--accent)]/55 " +
    "active:bg-[color-mix(in_srgb,var(--accent)_28%,transparent)]",
  secondary:
    "bg-[var(--surface-muted)] text-[var(--text-soft)] border border-[var(--border-soft)] " +
    "hover:bg-[var(--surface-hover)] hover:text-zinc-50 hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-soft)] border border-transparent " +
    "hover:bg-[var(--surface-muted)]/50 hover:text-zinc-50",
  danger:
    "bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/35 " +
    "hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] hover:border-[var(--danger)]/55",
  warning:
    "bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/35 " +
    "hover:bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] hover:border-[var(--warning)]/55",
  quiet:
    "bg-transparent text-[var(--text-muted)] border border-transparent " +
    "hover:bg-[var(--surface-muted)]/40 hover:text-[var(--text-soft)]",
};

const base =
  "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap " +
  "transition-colors focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--background)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function Button<As extends ElementType = "button">(props: ButtonProps<As>) {
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
  } = props as ButtonOwnProps<As> & Record<string, unknown>;

  const Tag = (as ?? "button") as ElementType;
  const tagProps: Record<string, unknown> =
    Tag === "button"
      ? { type: (rest as { type?: string }).type ?? "button" }
      : {};

  const finalClass = [
    base,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag {...tagProps} className={finalClass} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Tag>
  );
}
