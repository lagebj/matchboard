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
  type LucideIcon,
} from "lucide-react";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { requirePageActorContext, canAdmin } from "@/lib/auth/actor-context";
import { PageHeader } from "@/components/ui/page-header";
import { InstallPwaCard } from "@/components/pwa/install-prompt-card";

export const dynamic = "force-dynamic";

type MoreCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type MoreSection = {
  title: string;
  cards: MoreCard[];
};

export default async function MorePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const prefix = `/o/${orgSlug}`;

  const sections: MoreSection[] = [
    {
      title: "Analysis",
      cards: [
        { href: `${prefix}/insights`, label: "Insights", description: "Opportunity, load, coverage, and conflict review across the season.", icon: BarChart3 },
        { href: `${prefix}/season`, label: "Season", description: "Player-by-round matrix, movement paths, and fairness overview.", icon: Layers },
        { href: `${prefix}/history`, label: "History", description: "Historical audit of finalized selections and movement.", icon: History },
        { href: `${prefix}/opponents`, label: "Opponents", description: "Reusable opponent teams and encounter history.", icon: Swords },
      ],
    },
    {
      title: "Administration",
      cards: [
        { href: `${prefix}/groups`, label: "Groups", description: "Football groups, shared player pools, and base-group administration.", icon: Layers },
        { href: `${prefix}/formations`, label: "Formations", description: "Formation management by game format.", icon: LayoutGrid },
        { href: `${prefix}/rules`, label: "Rules", description: "Selection rules, support priority, and rotation paths.", icon: ListChecks },
        { href: `${prefix}/settings`, label: "Settings", description: "Organisation and account settings.", icon: Settings },
      ],
    },
    {
      title: "Workflow",
      cards: [
        { href: `${prefix}/reviews`, label: "Reviews", description: "Pending and resolved review requests.", icon: Bell },
      ],
    },
  ];

  if (canAdmin(ctx)) {
    sections.push({
      title: "Advanced",
      cards: [
        { href: `${prefix}/simulation`, label: "Simulation", description: "Dry-run season simulation using the real generation engine.", icon: FlaskConical },
        { href: `${prefix}/workbench`, label: "Policy workbench", description: "Policy evaluation workbench and fixture comparison.", icon: Wrench },
        { href: `${prefix}/opponent-population`, label: "Populate opponent levels", description: "Populate opponent sporting levels from historical match data (transient).", icon: Database },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="More" description="Analysis, administration, and secondary destinations." />

      <InstallPwaCard />

      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {section.title}
          </h2>
          <div className="grid gap-4 medium:grid-cols-2 large:grid-cols-3">
            {section.cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              >
                <div className="mb-2 flex items-center gap-3">
                  <card.icon className="h-5 w-5 text-[var(--text-muted)] group-hover:text-zinc-200" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white">{card.label}</h3>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
