export const dynamic = "force-dynamic";

import Link from "next/link";
import { TouchlineButton } from "@/components/touchline";
import { RulesForm } from "@/components/rules/rules-form";
import { RotationPathCreateForm } from "@/components/rules/rotation-path-create-form";
import { RotationPathCard } from "@/components/rules/rotation-path-card";
import { RotationPathGraph } from "@/components/rules/rotation-path-graph";
import { getRules } from "@/lib/rules/get-rules";
import { validateRuleConfig } from "@/lib/rules/validate-rules";
import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

type RulesPageProps = {
  searchParams: Promise<{
    error?: string;
    imported?: string;
    saved?: string;
  }>;
};

export default async function RulesPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: RulesPageProps["searchParams"] }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;
  const rules = await getRules(ctx.orgFilter);
  const { error, imported, saved } = await searchParams;
  const validation = validateRuleConfig(rules);

  const [rotationPaths, teams] = await Promise.all([
    db.rotationPath.findMany({
      where: { active: true, ...orgWhere },
      include: {
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }],
    }),
    db.team.findMany({
      where: { archivedAt: null, ...orgWhere },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rotationPathItems = rotationPaths.map((p) => ({
    id: p.id,
    role: p.role,
    direction: "outgoing" as const,
    fromTeamId: p.fromTeam.id,
    fromTeamName: p.fromTeam.name,
    toTeamId: p.toTeam.id,
    toTeamName: p.toTeam.name,
    purpose: p.purpose,
    priority: p.priority,
    minimumCount: p.minimumCount,
    targetCount: p.targetCount,
    maximumCount: p.maximumCount,
    cooldownRounds: p.cooldownRounds,
    active: p.active,
  }));

  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }));

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 9).
    <div className="touchline flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Rules · v{rules.version}</p>
          <span className="text-[10px] text-[var(--text-muted)]">{rules.minDaysBetweenAnyMatches}d spacing</span>
        </div>
        <div className="flex gap-1.5">
          <Link
            className="h-6 rounded border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-2 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--foreground)]"
            href="/api/rules"
            download
          >
            Export
          </Link>
          <Link
            className="h-6 rounded border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-2 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--foreground)]"
            href="#rule-import-section"
          >
            Import
          </Link>
        </div>
      </div>

      {error && <div className="rounded-md border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-3 py-2 text-xs text-[var(--danger)]">{error}</div>}
      {imported && <div className="rounded-md border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] px-3 py-2 text-xs text-[var(--success)]">Rules imported successfully.</div>}

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {validation.errors.map((err) => (
            <div key={err.code} className="rounded-md border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[var(--danger-subtle)] px-3 py-2 text-xs text-[var(--danger)]">
              <span className="font-medium">{err.field}:</span> {err.message}
            </div>
          ))}
          {validation.warnings.map((warn) => (
            <div key={warn.code} className="rounded-md border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] px-3 py-2 text-xs text-[var(--warning)]">
              <span className="font-medium">{warn.field}:</span> {warn.message}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Rotation paths</p>
          <span className="text-[10px] text-[var(--text-muted)]">{rotationPathItems.length} active</span>
        </div>

        {teamOptions.length > 0 && (
          <RotationPathGraph
            teams={teamOptions}
            paths={rotationPathItems.map((p) => ({
              id: p.id,
              fromTeamId: p.fromTeamId,
              fromTeamName: p.fromTeamName,
              toTeamId: p.toTeamId,
              toTeamName: p.toTeamName,
              role: p.role,
              purpose: p.purpose,
              priority: p.priority,
            }))}
          />
        )}

        {rotationPathItems.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {rotationPathItems.map((path) => (
              <RotationPathCard key={path.id} path={path} teamId={path.fromTeamId} direction="outgoing" />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-muted)]">No rotation paths. Add paths to enable support, development, or squad repair movement between teams.</p>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--foreground)]">Add rotation path</summary>
          <div className="mt-2">
            <RotationPathCreateForm teams={teamOptions} />
          </div>
        </details>
      </div>

      <div className="rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Configuration</p>
        <RulesForm rules={rules} saved={saved === "1"} />
      </div>

      <div id="rule-import-section" className="rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Import rules</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Paste a previously exported rule configuration JSON.</p>
        <form action="/api/rules" method="POST" className="mt-2 flex flex-col gap-2">
          <textarea
            name="rulesJson"
            rows={4}
            placeholder="Paste rule configuration JSON..."
            className="rounded-md border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <TouchlineButton type="submit" variant="primary" size="sm">
            Validate and import
          </TouchlineButton>
        </form>
      </div>
    </div>
  );
}