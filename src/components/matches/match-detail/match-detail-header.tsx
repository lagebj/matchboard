import Link from "next/link";
import type { ReactNode } from "react";
import { MatchLifecycleBadge } from "@/components/ui/status-badge";
import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";

/**
 * MatchDetailHeader — the persistent identity/action grammar above the tab rail
 * (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md` / `04_MATCH_DETAILS_AFTER_MATCH_SPEC.md` "Header").
 * Deliberately carries no score/jersey — both canonical goldens put the team-vs-opponent result
 * card inside the Overview tab body (`MatchIdentityCard`), not the sticky header.
 *
 * Reuses the existing `MatchLifecycleBadge`/`lifecycleStatusConfigFor()` vocabulary (ADR-0101)
 * rather than the goldens' illustrative literal "UPCOMING"/"COMPLETED" strings — the written spec
 * itself names this as the accepted equivalent (`03` spec: "lifecycle badge equivalent to
 * `UPCOMING` / current canonical lifecycle wording").
 */
type Props = {
  breadcrumbLabel: string;
  breadcrumbHref: string;
  title: string;
  lifecycleStatus: MatchLifecycleStatus;
  metaLine: string;
  primaryAction?: ReactNode;
  overflowAction?: ReactNode;
};

export function MatchDetailHeader({
  breadcrumbLabel,
  breadcrumbHref,
  title,
  lifecycleStatus,
  metaLine,
  primaryAction,
  overflowAction,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <Link href={breadcrumbHref} className="hover:text-[var(--text-soft)] transition-colors">
            {breadcrumbLabel}
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-[var(--text-soft)]">{title}</span>
        </div>
        <MatchLifecycleBadge status={lifecycleStatus} size="sm" />
      </div>

      <h1 className="text-[22px] font-[650] leading-tight text-[var(--foreground)]">{title}</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text-muted)]">{metaLine}</p>
        {(primaryAction || overflowAction) && (
          <div className="flex items-center gap-2">
            {primaryAction}
            {overflowAction}
          </div>
        )}
      </div>
    </div>
  );
}
