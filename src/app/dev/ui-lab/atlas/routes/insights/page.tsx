import Link from "next/link";
import { TouchlinePageHeader } from "@/components/touchline";
import { EvidenceSpotlightWidget } from "@/components/touchline/widgets";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav, insightsViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Insights overview — `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §C`.
 * Golden: touchline-v1-insights-mobile.png (mobile) / atlas-football-intelligence.png panel 3
 * (desktop, corrected — no "% of possessions end with a shot": see
 * docs/domain/touchline-atlas-provenance.md §0.8/§4).
 *
 * Four narrative groups, one primary + up to 2 supporting stories each — never a metrics wall.
 */
export default function AtlasInsightsPage() {
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[1180px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Insights" context="Evidence-based coaching stories" />

      <div className="mt-5 grid grid-cols-1 gap-5 expanded:grid-cols-2">
        {insightsViewModel.groups.map((group) => (
          <TouchlineWidget key={group.key} tone="support">
            <WidgetHeader title={group.title} action={<Link href={group.exploreHref} className="text-[13px] font-medium text-[var(--accent)] no-underline">Explore →</Link>} />
            <div className="mt-3 flex flex-col gap-3">
              {group.primary ? (
                <EvidenceSpotlightWidget
                  question={group.primary.title}
                  label={group.primary.label}
                  title={group.primary.title}
                  value={group.primary.value}
                  valueCaption={group.primary.valueCaption}
                  sample={group.primary.sample}
                  confidence={group.primary.confidence}
                  detailHref={group.primary.detailHref}
                />
              ) : (
                <p className="text-[13px] text-[var(--text-muted)]">Not enough evidence yet.</p>
              )}
              {group.supporting.map((story) => (
                <div key={story.id} className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{story.label}</p>
                  <p className="mt-0.5 text-[14px] font-[600] text-[var(--foreground)]">{story.title}</p>
                  {story.sample ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{story.sample}</p> : null}
                </div>
              ))}
            </div>
          </TouchlineWidget>
        ))}
      </div>
    </UiLabShell>
  );
}
