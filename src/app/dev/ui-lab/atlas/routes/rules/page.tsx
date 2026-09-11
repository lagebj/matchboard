import { TouchlinePageHeader } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav, rotationPathRows } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Rules — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §C`. Grouped rule sections, each with
 * label/short consequence/control. The golden is layout authority only — no rule options beyond
 * the current rule model (squad size, support priority, rotation paths).
 */
export default function AtlasRulesPage() {
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[820px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Rules" context="Selection rules, support priority, and rotation paths" />

      <div className="mt-5 flex flex-col gap-4">
        <TouchlineWidget>
          <WidgetHeader eyebrow="Squad size" title="Target, minimum, and maximum" />
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-[var(--text-soft)]">Below minimum blocks finalisation; above maximum requires override.</span>
            <button type="button" className="shrink-0 rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] px-3 py-1.5 text-[13px] font-[600] text-[var(--foreground)]">Edit</button>
          </div>
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Support priority" title="Rank 1 is highest" />
          <p className="mt-2 text-[13px] text-[var(--text-soft)]">Priority 1 is resolved before priority 2 when required support is contested.</p>
        </TouchlineWidget>

        <TouchlineWidget>
          <WidgetHeader eyebrow="Rotation paths" title={`${rotationPathRows.length} active`} />
          <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
            {rotationPathRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="text-[var(--foreground)]">{r.fromTeamName} → {r.toTeamName}</span>
                <span className="text-[var(--text-muted)]">{r.role} · {r.active ? "Active" : "Inactive"}</span>
              </li>
            ))}
          </ul>
        </TouchlineWidget>
      </div>
    </UiLabShell>
  );
}
