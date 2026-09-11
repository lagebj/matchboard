import Link from "next/link";
import { TouchlinePageHeader } from "@/components/touchline";
import { atlasNav } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const GROUPS: { title: string; items: { label: string; href: string }[] }[] = [
  { title: "Coaching & evidence", items: [{ label: "Insights", href: "../insights" }] },
  { title: "Competition & history", items: [{ label: "Season", href: "../season" }, { label: "History", href: "../history" }, { label: "Opponents", href: "../opponents" }] },
  { title: "Structure & configuration", items: [{ label: "Groups", href: "../groups" }, { label: "Formations", href: "../formations" }, { label: "Rules", href: "../rules" }] },
  { title: "Collaboration", items: [{ label: "Peer reviews", href: "../reviews" }] },
  { title: "Settings", items: [{ label: "Settings", href: "../settings" }] },
];

/**
 * More — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §E`. Grouped navigation hub. Install
 * callout is omitted here (already covered by the existing production `InstallPwaCard`, out of
 * this composition's scope per `11_BRAND_ICON_AND_PWA_CONTRACT.md`).
 */
export default function AtlasMorePage() {
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[560px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="More" context="Analysis, administration, and secondary destinations" />

      <div className="mt-5 flex flex-col gap-6">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{g.title}</p>
            <ul className="divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
              {g.items.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex items-center justify-between py-3 text-[14px] font-[600] text-[var(--foreground)] no-underline">
                    {item.label}
                    <span aria-hidden="true" className="text-[var(--text-muted)]">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </UiLabShell>
  );
}
