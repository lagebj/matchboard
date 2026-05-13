"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import type { TeamConfiguration } from "@/domain/team-configuration/types";
import { fetchTeamConfiguration, updateTeamConfigurationAction } from "@/domain/team-configuration/actions";

function RuleRow({ rule, onEdit }: { rule: TeamConfiguration["rules"][0]; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-200">{rule.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{rule.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rule.value && <span className="text-xs text-zinc-400">{rule.value}</span>}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${rule.scope === "TEAM" ? "bg-blue-900/30 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
          {rule.scope}
        </span>
        {rule.editable && onEdit ? (
          <button onClick={onEdit} className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-900/50">
            Edit
          </button>
        ) : rule.editable ? (
          <span className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[10px] text-emerald-300">Editable</span>
        ) : (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">Read-only</span>
        )}
      </div>
    </div>
  );
}

function SquadSettingsForm({ config }: { config: TeamConfiguration }) {
  const [targetSquadSize, setTargetSquadSize] = useState(config.targetSquadSize);
  const [maxSquadSize, setMaxSquadSize] = useState(config.maxSquadSize);
  const [supportPriority, setSupportPriority] = useState(config.supportPriority);
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
          maxSquadSize,
          supportPriority,
        });
        setSuccess(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Target squad size</label>
          <input
            type="number"
            value={targetSquadSize}
            onChange={(e) => setTargetSquadSize(Number(e.target.value))}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
            min={1}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Max squad size</label>
          <input
            type="number"
            value={maxSquadSize}
            onChange={(e) => setMaxSquadSize(Number(e.target.value))}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
            min={targetSquadSize}
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Support priority rank</label>
          <input
            type="number"
            value={supportPriority}
            onChange={(e) => setSupportPriority(Number(e.target.value))}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
            min={0}
          />
          <span className="text-[10px] text-zinc-500">1 is highest priority</span>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-emerald-400">Settings saved.</p>}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="self-start rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save squad settings"}
      </button>
    </div>
  );
}

export function TeamConfigurationPage({ teamId }: { teamId: string }) {
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
    return <div className="p-4 text-sm text-zinc-500">Loading team configuration...</div>;
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <p className="text-sm text-zinc-400">Team not found.</p>
        <Link href="/teams" className="text-xs text-zinc-500 hover:text-zinc-300">Back to teams</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Team Configuration</p>
          <h1 className="text-lg font-semibold text-zinc-100">{config.name}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Configure squad settings and selection rules for this team.</p>
        </div>
        <Link href={`/teams/${teamId}/review`} className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700">
          Review
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">Identity</h2>
        <div className="rounded border border-zinc-800 bg-zinc-900/30 px-4 py-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-zinc-500">Name:</span> <span className="text-zinc-200">{config.name}</span></div>
            <div><span className="text-zinc-500">Core group:</span> <span className="text-zinc-200">{config.coreGroup}</span></div>
            <div><span className="text-zinc-500">Status:</span> <span className={config.active ? "text-emerald-400" : "text-zinc-500"}>{config.active ? "Active" : "Archived"}</span></div>
          </div>
        </div>
      </section>

      <section ref={squadSettingsRef} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">Squad settings</h2>
        <SquadSettingsForm config={config} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">Rule configuration</h2>
        <p className="text-xs text-zinc-500">Rules may be implemented globally, but this page shows how they affect this team.</p>
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