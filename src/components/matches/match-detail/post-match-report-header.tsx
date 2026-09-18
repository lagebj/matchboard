import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { MatchIdentityCard } from "@/components/matches/match-detail/match-identity-card";
import { MetricStrip, type MetricStripItem } from "@/components/touchline/widget/metric-strip";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import type { PostMatchReportSurfaceState } from "@/lib/matches/match-detail-tabs";

/**
 * Post-Match Report header (`05_POST_MATCH_DRAFT_SPEC.md` / `06_POST_MATCH_COMPLETED_SPEC.md`
 * "Header"). Distinct from `MatchDetailHeader` — the exact canonical golden
 * (`references/golden/crops/05_post_match_draft_desktop_and_mobile.png` /
 * `06_post_match_completed_desktop_and_mobile.png`) keeps the identity/score block persistently
 * above the tabs here, unlike root Match Details which defers it into the Overview tab body.
 *
 * `REPORT DRAFT` / `COMPLETED` are this surface's own real state names
 * (`02_PRODUCT_MODEL_AND_LIFECYCLE.md` "Surface B: Post-Match Report"), not a re-labelling of the
 * Match Details lifecycle badge vocabulary (ADR-0101) — a different, deliberate surface.
 */
export function PostMatchReportHeader({
  breadcrumbLabel,
  breadcrumbHref,
  title,
  surfaceState,
  completedByLabel,
  presentation,
  ownKitColor,
  presentCount,
  totalCount,
  noShowCount,
  goalsCount,
  assistsCount,
}: {
  breadcrumbLabel: string;
  breadcrumbHref: string;
  title: string;
  surfaceState: PostMatchReportSurfaceState;
  completedByLabel: string | null;
  presentation: MatchPresentation;
  ownKitColor: string | null;
  presentCount: number;
  totalCount: number;
  noShowCount: number;
  goalsCount: number;
  assistsCount: number;
}) {
  const items: MetricStripItem[] = [
    { id: "present", label: "Present", value: `${presentCount}/${totalCount}` },
    { id: "no-show", label: "No-show", value: String(noShowCount), tone: noShowCount > 0 ? "attention" : "neutral" },
    { id: "goals", label: "Goals", value: String(goalsCount) },
    { id: "assists", label: "Assists", value: String(assistsCount) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
          <Link href={breadcrumbHref} className="hover:text-[var(--text-soft)] transition-colors">
            {breadcrumbLabel}
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-[var(--text-soft)]">{title}</span>
        </div>
        <StatusPill variant={surfaceState === "COMPLETED" ? "success" : "warning"} size="md">
          {surfaceState === "COMPLETED" ? "Completed" : "Report draft"}
        </StatusPill>
      </div>

      <h1 className="text-[22px] font-[650] leading-tight text-[var(--foreground)]">{title}</h1>
      {completedByLabel && <p className="text-[13px] text-[var(--text-muted)]">{completedByLabel}</p>}

      <div className="flex flex-col items-center gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-5">
        <MatchIdentityCard presentation={presentation} ownKitColor={ownKitColor} />
        <MetricStrip items={items} />
      </div>
    </div>
  );
}
