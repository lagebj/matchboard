export const dynamic = "force-dynamic";

import Link from "next/link";
import { RulesForm } from "@/components/rules/rules-form";
import { RotationPathCreateForm } from "@/components/rules/rotation-path-create-form";
import { RotationPathCard } from "@/components/rules/rotation-path-card";
import { getRules } from "@/lib/rules/get-rules";
import { validateRuleConfig } from "@/lib/rules/validate-rules";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";

type RulesPageProps = {
  searchParams: Promise<{
    error?: string;
    imported?: string;
    saved?: string;
  }>;
};

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  const orgWhere = orgFilter.type === 'org' ? orgFilter.filter : {};
  const rules = await getRules(orgFilter);
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Rules · v{rules.version}</p>
          <span className="text-[10px] text-zinc-500">{rules.minDaysBetweenAnyMatches}d spacing</span>
        </div>
        <div className="flex gap-1.5">
          <Link
            className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200"
            href="/api/rules"
            download
          >
            Export
          </Link>
          <Link
            className="h-6 rounded border border-zinc-700/50 bg-zinc-800/30 px-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200"
            href="#rule-import-section"
          >
            Import
          </Link>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>}
      {imported && <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">Rules imported successfully.</div>}

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {validation.errors.map((err) => (
            <div key={err.code} className="rounded-md border border-red-800/30 bg-red-900/15 px-3 py-2 text-xs text-red-300">
              <span className="font-medium">{err.field}:</span> {err.message}
            </div>
          ))}
          {validation.warnings.map((warn) => (
            <div key={warn.code} className="rounded-md border border-amber-700/30 bg-amber-900/15 px-3 py-2 text-xs text-amber-300">
              <span className="font-medium">{warn.field}:</span> {warn.message}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Rotation paths</p>
          <span className="text-[10px] text-zinc-500">{rotationPathItems.length} active</span>
        </div>

        {rotationPathItems.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {rotationPathItems.map((path) => (
              <RotationPathCard key={path.id} path={path} teamId={path.fromTeamId} direction="outgoing" />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No rotation paths. Add paths to enable support, development, or squad repair movement between teams.</p>
        )}

        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] font-medium text-zinc-400 hover:text-zinc-200">Add rotation path</summary>
          <div className="mt-2">
            <RotationPathCreateForm teams={teamOptions} />
          </div>
        </details>
      </div>

      <div className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Configuration</p>
        <RulesForm rules={rules} saved={saved === "1"} />
      </div>

      <div id="rule-import-section" className="rounded-md border border-zinc-700/40 bg-zinc-800/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Import rules</p>
        <p className="mt-1 text-xs text-zinc-500">Paste a previously exported rule configuration JSON.</p>
        <form action="/api/rules" method="POST" className="mt-2 flex flex-col gap-2">
          <textarea
            name="rulesJson"
            rows={4}
            placeholder="Paste rule configuration JSON..."
            className="rounded-md border border-zinc-700/40 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            className="h-7 rounded-md border border-blue-700/30 bg-blue-900/20 px-3 text-xs font-medium text-blue-300 hover:bg-blue-900/30"
          >
            Validate and import
          </button>
        </form>
      </div>
    </div>
  );
}