import type { ElementType, ReactNode } from "react";

/**
 * Surface — calm, consistent panel primitive.
 *
 * Replaces the assortment of `rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)]`
 * and `rounded-md border border-zinc-700/40 bg-zinc-800/20` patterns that previously
 * appeared throughout the app. Default surfaces use background contrast and spacing
 * rather than borders; explicit borders are reserved for semantic variants.
 *
 * Per ADR 0007: raised surfaces should be rare. Saturated backgrounds and strong
 * glow effects are avoided. Semantic variants (danger/warning/success/info) carry
 * a hairline accent rather than a heavy filled background.
 */
export type SurfaceVariant =
  | "default"
  | "raised"
  | "subtle"
  | "active"
  | "danger"
  | "warning"
  | "success"
  | "info";

export type SurfacePadding = "none" | "sm" | "md" | "lg";

type SurfaceOwnProps<As extends ElementType> = {
  as?: As;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  className?: string;
  children?: ReactNode;
};

type SurfaceProps<As extends ElementType> = SurfaceOwnProps<As> &
  Omit<React.ComponentPropsWithoutRef<As>, keyof SurfaceOwnProps<As>>;

const variantClasses: Record<SurfaceVariant, string> = {
  default:
    "bg-[var(--surface-base)] border border-[var(--border-soft)]",
  raised:
    "bg-[var(--surface-raised)] border border-[var(--border-strong)] shadow-[0_18px_44px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)]",
  subtle:
    "bg-[var(--surface-muted)]/40 border border-transparent",
  active:
    "bg-[var(--accent-subtle)] border border-[var(--accent)]/40",
  danger:
    "bg-[var(--danger-subtle)] border border-[var(--danger)]/35",
  warning:
    "bg-[var(--warning-subtle)] border border-[var(--warning)]/35",
  success:
    "bg-[var(--accent-subtle)] border border-[var(--accent)]/35",
  info:
    "bg-[var(--info-subtle)] border border-[var(--info)]/35",
};

const paddingClasses: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Surface<As extends ElementType = "div">(props: SurfaceProps<As>) {
  const {
    as,
    variant = "default",
    padding = "none",
    className,
    children,
    ...rest
  } = props as SurfaceOwnProps<As> & Record<string, unknown>;
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={`rounded-xl ${variantClasses[variant]} ${paddingClasses[padding]} ${className ?? ""}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
