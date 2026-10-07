import Link from "next/link";
import {
  Users,
  ListChecks,
  FlaskConical,
  Wrench,
  Database,
  type LucideIcon,
} from "lucide-react";
import { InstallPwaCard } from "@/components/pwa/install-prompt-card";

type SettingsLinkRow = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

function SettingsLinkList({ rows, prefix }: { rows: SettingsLinkRow[]; prefix: string }) {
  return (
    <ul className="divide-y divide-[var(--border-soft)] rounded-[var(--radius-object)] border border-[var(--border-soft)] bg-[var(--surface-raised)]">
      {rows.map((row) => (
        <li key={row.href}>
          <Link
            href={`${prefix}${row.href}`}
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
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Settings' non-football administration discovery sections (ADR-0157 slice C8,
 * `10_INFORMATION_ARCHITECTURE_CONVERGENCE.md` "Settings target sections"). The routes
 * themselves are unchanged implementation routes — Settings is the discovery surface that
 * replaces the retired More hub. Football jobs (Insights/Season/History/Opponents/Formations/
 * Reviews) are never re-listed here; they have their own contextual homes.
 */
export function SettingsDiscoverySections({
  orgSlug,
  isAdmin,
}: {
  orgSlug: string;
  isAdmin: boolean;
}) {
  const prefix = `/o/${orgSlug}`;
  const structureRows: SettingsLinkRow[] = [
    {
      href: "/groups",
      label: "Groups and access",
      description: "Football groups, shared player pools, base-group and guest-player administration.",
      icon: Users,
    },
    {
      href: "/rules",
      label: "Rules and policy configuration",
      description: "Selection rules, support priority, and rotation paths.",
      icon: ListChecks,
    },
  ];

  const advancedRows: SettingsLinkRow[] = [
    {
      href: "/simulation",
      label: "Season Planning Simulation",
      description: "Dry-run season simulation using the real generation engine.",
      icon: FlaskConical,
    },
    {
      href: "/workbench",
      label: "Policy workbench",
      description: "Policy evaluation workbench and fixture comparison.",
      icon: Wrench,
    },
    {
      href: "/evidence-rebuild",
      label: "Rebuild historical evidence",
      description: "Reprocess completed matches through the current evidence engine (transient).",
      icon: Database,
    },
    {
      href: "/opponent-population",
      label: "Populate opponent levels",
      description: "Populate opponent sporting levels from historical match data (transient).",
      icon: Database,
    },
    {
      href: "/ai-backfill",
      label: "Run AI analysis on existing data",
      description: "Queue Assistant Coach reviews and note structuring for existing data (transient).",
      icon: Database,
    },
  ];

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Structure and configuration</h2>
        <SettingsLinkList rows={structureRows} prefix={prefix} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">App installation</h2>
        <InstallPwaCard />
      </section>

      {isAdmin && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Advanced tools</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Admin-only. These tools never appear in primary football navigation.
          </p>
          <SettingsLinkList rows={advancedRows} prefix={prefix} />
        </section>
      )}
    </>
  );
}