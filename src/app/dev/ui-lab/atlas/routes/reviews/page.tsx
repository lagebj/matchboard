import { TouchlinePageHeader } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav, reviewsViewModel } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

function ReviewGroup({ title, rows }: { title: string; rows: typeof reviewsViewModel.pendingForMe }) {
  if (rows.length === 0) return null;
  return (
    <TouchlineWidget>
      <WidgetHeader eyebrow={title} title={`${rows.length}`} />
      <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="min-w-0">
              <span className="block font-[600] text-[var(--foreground)]">{r.targetLabel}</span>
              {r.requestMessage ? <span className="block text-[12px] text-[var(--text-muted)]">{r.requestMessage}</span> : null}
            </span>
            <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{r.status}</span>
          </li>
        ))}
      </ul>
    </TouchlineWidget>
  );
}

/**
 * Peer reviews — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §F`. Pending for me /
 * Requested by me / History, using real `ReviewRequest` semantics only. Decision review is a
 * distinct, separate concept — never mixed into this list.
 */
export default function AtlasReviewsPage() {
  const vm = reviewsViewModel;
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[720px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Peer reviews" context="Review requests between coaches" />
      <div className="mt-5 flex flex-col gap-4">
        <ReviewGroup title="Pending for me" rows={vm.pendingForMe} />
        <ReviewGroup title="Requested by me" rows={vm.requestedByMe} />
        <ReviewGroup title="History" rows={vm.history} />
      </div>
    </UiLabShell>
  );
}
