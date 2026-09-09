import Link from "next/link";
import {
  BarChart3,
  Swords,
  Layers,
  LayoutGrid,
  ListChecks,
  History,
  Bell,
  Settings,
  FlaskConical,
  Wrench,
  Database,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { requirePageActorContext, canAdmin } from "@/lib/auth/actor-context";
import { PageHeader } from "@/components/ui/page-header";
import { InstallPwaCard } from "@/components/pwa/install-prompt-card";

export const dynamic = "force-dynamic";

type MoreRow = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type MoreSection = {
  title: string;
  rows: MoreRow[];
};

export default async function MorePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const prefix = `/o/${orgSlug}`;

  // Grouped row navigation (Product Surface 1.0 / surface spec §More): default to grouped rows,
  // not a tile grid. Groups: Coaching and evidence; Competition and history; Structure and
  // configuration; Collaboration; Settings (+ an admin-only Advanced group).
  const sections: MoreSection[] = [
    {
      title: "Coaching and evidence",
      rows: [
        { href: `${prefix}/insights`, label: "Insights", description: "Opportunity, load, coverage, timing patterns, and conflict review across the season.", icon: BarChart3 },
      ],
    },
    {
      title: "Competition and history",
      rows: [
        { href: `${prefix}/season`, label: "Season", description: "Player-by-round matrix, movement paths, and fairness overview.", icon: Layers },
        { href: `${prefix}/history`, label: "History", description: "Historical audit of finalized selections and movement.", icon: History },
        { href: `${prefix}/opponents`, label: "Opponents", description: "Reusable opponent teams and encounter history.", icon: Swords },
      ],
    },
    {
      title: "Structure and configuration",
      rows: [
        { href: `${prefix}/groups`, label: "Groups", description: "Football groups, shared player pools, base-group and guest-player administration.", icon: Layers },
        { href: `${prefix}/formations`, label: "Formations", description: "Formation management by game format; each slot shows its derived exact planning role.", icon: LayoutGrid },
        { href: `${prefix}/rules`, label: "Rules", description: "Selection rules, support priority, and rotation paths.", icon: ListChecks },
      ],
    },
    {
      title: "Collaboration",
      rows: [
        { href: `${prefix}/reviews`, label: "Peer reviews", description: "Ask another coach to review a lineup or event squad; pending and resolved requests.", icon: Bell },
      ],
    },
    {
      title: "Settings",
      rows: [
        { href: `${prefix}/settings`, label: "Settings", description: "Organisation and account settings.", icon: Settings },
      ],
    },
  ];

  if (canAdmin(ctx)) {
    sections.push({
      title: "Advanced",
      rows: [
        { href: `${prefix}/simulation`, label: "Simulation", description: "Dry-run season simulation using the real generation engine.", icon: FlaskConical },
        { href: `${prefix}/workbench`, label: "Policy workbench", description: "Policy evaluation workbench and fixture comparison.", icon: Wrench },
        { href: `${prefix}/opponent-population`, label: "Populate opponent levels", description: "Populate opponent sporting levels from historical match data (transient).", icon: Database },
        { href: `${prefix}/evidence-rebuild`, label: "Rebuild historical evidence", description: "Reprocess completed matches through the current evidence engine (transient).", icon: Database },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="More" description="Analysis, administration, and secondary destinations." />

      <InstallPwaCard />

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-[var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {section.title}
          </h2>
          <ul className="divide-y divide-[var(--border-soft)] rounded-[var(--radius-object)] border border-[var(--border-soft)] bg-[var(--surface-raised)]">
            {section.rows.map((row) => (
              <li key={row.href}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] focus-visible:outline-none"
                >
                  <row.icon className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[var(--text-row-title)] font-medium text-[var(--foreground)]">
                      {row.label}
                    </span>
                    <span className="block text-[var(--text-meta)] leading-relaxed text-[var(--text-muted)]">
                      {row.description}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-disabled)]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
