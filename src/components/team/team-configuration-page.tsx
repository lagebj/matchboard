"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import type { TeamConfiguration } from "@/domain/team-configuration/types";
import { fetchTeamConfiguration, updateTeamConfigurationAction } from "@/domain/team-configuration/actions";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { StatusPill } from "@/components/ui/status-pill";
import { useOrgUrl } from "@/components/shell/org-slug-context";

function RuleRow({ rule, onEdit }: { rule: TeamConfiguration["rules"][0]; onEdit?: () => void }) {
  return (
    <Surface variant="default" padding="sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--text-soft)]">{rule.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{rule.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rule.value && <span className="text-xs text-[var(--text-muted)]">{rule.value}</span>}
          <StatusPill variant={rule.scope === "TEAM" ? "info" : "neutral"} size="sm">
            {rule.scope}
          </StatusPill>
          {rule.editable && onEdit ? (
            <button onClick={onEdit} className="text-[10px] text-[var(--accent-strong)] hover:underline">
              Edit
            </button>
          ) : rule.editable ? (
            <span className="text-[10px] text-[var(--accent-strong)]">Editable</span>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]">Read-only</span>
          )}
        </div>
      </div>
    </Surface>
  );
}

function SquadSettingsForm({ config }: { config: TeamConfiguration }) {
  const [targetSquadSize, setTargetSquadSize] = useState(config.targetSquadSize);
  const [minAcceptedSquadSize, setMinAcceptedSquadSize] = useState(config.minAcceptedSquadSize);
  const [maxSquadSize, setMaxSquadSize] = useState(config.maxSquadSize);
  const [minCorePlayers, setMinCorePlayers] = useState(config.minCorePlayers);
  const [supportPriority, setSupportPriority] = useState(config.supportPriority);
  const [minSupportPlayers, setMinSupportPlayers] = useState(config.minSupportPlayers);
  const [developmentSlots, setDevelopmentSlots] = useState(config.developmentSlots);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await updateTeamConfigurationAction(config.teamId, {
          targetSquadSize,
          minAcceptedSquadSize,
          maxSquadSize,
          minCorePlayers,
          supportPriority,
          minSupportPlayers,
          developmentSlots,
        });
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Target squad size</label>
          <input
            type="number"
            value={targetSquadSize}
            onChange={(e) => setTargetSquadSize(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Min accepted squad size</label>
          <input
            type="number"
            value={minAcceptedSquadSize}
            onChange={(e) => setMinAcceptedSquadSize(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={1}
          />
          <span className="text-[10px] text-[var(--text-muted)]">Minimum to field a team</span>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Max squad size</label>
          <input
            type="number"
            value={maxSquadSize}
            onChange={(e) => setMaxSquadSize(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={targetSquadSize}
          />
          <span className="text-[10px] text-[var(--text-muted)]">Hard ceiling, requires override above</span>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Min core players</label>
          <input
            type="number"
            value={minCorePlayers}
            onChange={(e) => setMinCorePlayers(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={0}
          />
          <span className="text-[10px] text-[var(--text-muted)]">Minimum core selections before support</span>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Support priority rank</label>
          <input
            type="number"
            value={supportPriority}
            onChange={(e) => setSupportPriority(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={0}
          />
          <span className="text-[10px] text-[var(--text-muted)]">1 is highest priority</span>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Min support players</label>
          <input
            type="number"
            value={minSupportPlayers}
            onChange={(e) => setMinSupportPlayers(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={0}
          />
          <span className="text-[10px] text-[var(--text-muted)]">Required support before development</span>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Development slots</label>
          <input
            type="number"
            value={developmentSlots}
            onChange={(e) => setDevelopmentSlots(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
            min={0}
          />
          <span className="text-[10px] text-[var(--text-muted)]">Development movement capacity</span>
        </div>
      </div>
      {error && <DecisionBanner variant="blocked" title={error} />}
      {success && <DecisionBanner variant="success" title="Settings saved." />}
      <Button variant="secondary" size="sm" disabled={isPending} onClick={handleSave}>
        {isPending ? "Saving..." : "Save squad settings"}
      </Button>
    </div>
  );
}

export function TeamConfigurationPage({ teamId }: { teamId: string }) {
  const orgUrl = useOrgUrl();
  const [config, setConfig] = useState<TeamConfiguration | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchTeamConfiguration(teamId);
      setConfig(result);
    });
  }, [teamId, startTransition]);

  const squadSettingsRef = useRef<HTMLDivElement>(null);

  function scrollToSquadSettings() {
    squadSettingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (isPending && !config) {
    return <div className="p-4 text-sm text-[var(--text-muted)]">Loading team configuration...</div>;
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <p className="text-sm text-[var(--text-soft)]">Team not found.</p>
        <Button variant="ghost" size="sm" as="a" href={orgUrl("/teams")}>Back to teams</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Team Configuration</p>
          <h1 className="text-lg font-semibold text-zinc-100">{config.name}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Configure squad settings and selection rules for this team.</p>
        </div>
        <Button variant="ghost" size="sm" as="a" href={orgUrl(`/teams/${teamId}`)}>
          Back to team
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <SectionHeader title="Identity" />
        <Surface variant="default" padding="md">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-[var(--text-muted)]">Name:</span> <span className="text-[var(--text-soft)]">{config.name}</span></div>
            <div><span className="text-[var(--text-muted)]">Core group:</span> <span className="text-[var(--text-soft)]">{config.coreGroup}</span></div>
            <div><span className="text-[var(--text-muted)]">Status:</span> <span className={config.active ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"}>{config.active ? "Active" : "Archived"}</span></div>
            <div><span className="text-[var(--text-muted)]">Group:</span> <span className="text-[var(--text-soft)]">
              {config.footballGroup
                ? <a href={orgUrl(`/groups/${config.footballGroup.slug}`)} className="text-[var(--accent-strong)] hover:underline">{config.footballGroup.name}</a>
                : "No group assigned"}
            </span></div>
          </div>
        </Surface>
      </section>

      <section ref={squadSettingsRef} className="flex flex-col gap-2">
        <SectionHeader title="Squad settings" />
        <SquadSettingsForm config={config} />
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title="Rule configuration" description="Rules may be implemented globally, but this page shows how they affect this team." />
        <div className="flex flex-col gap-1.5">
          {config.rules.map((rule) => (
            <RuleRow
              key={rule.ruleId}
              rule={rule}
              onEdit={rule.editable ? scrollToSquadSettings : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}