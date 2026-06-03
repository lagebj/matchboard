"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createMatchAction } from "@/app/(app)/matches/actions";
import { OpponentTeamSelect } from "@/components/opponents/opponent-team-select";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create match"}
    </button>
  );
}

const INITIAL_STATE = { error: "" };

export function MatchCreateForm({
  teams,
  opponentTeams,
}: {
  teams: { id: string; name: string }[];
  opponentTeams: { id: string; displayName: string }[];
}) {
  const [state, formAction] = useActionState(createMatchAction, INITIAL_STATE);
  const [selectedOpponentTeamId, setSelectedOpponentTeamId] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  if (teams.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
        Create at least one team before adding matches.{" "}
        <Link href="/teams/new" className="underline text-[var(--accent-strong)]">
          Create a team
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="teamId" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Team
        </label>
        <select
          id="teamId"
          name="teamId"
          required
          defaultValue={teams[0]?.id}
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <OpponentTeamSelect
        opponentTeams={opponentTeams}
        selectedId={selectedOpponentTeamId}
        onSelectionChange={(id, _name) => {
          setSelectedOpponentTeamId(id);
        }}
        onCreateNew={(_name) => {
          setSelectedOpponentTeamId(null);
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="startsAt" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Match date
        </label>
        <input
          id="startsAt"
          name="startsAt"
          type="date"
          required
          defaultValue={today}
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="homeAway" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Home or away
        </label>
        <select
          id="homeAway"
          name="homeAway"
          required
          defaultValue="HOME"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
        >
          <option value="HOME">Home</option>
          <option value="AWAY">Away</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="matchType" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Match type
        </label>
        <select
          id="matchType"
          name="matchType"
          required
          defaultValue="FRIENDLY"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
        >
          <option value="LEAGUE">League</option>
          <option value="FRIENDLY">Friendly</option>
          <option value="CUP">Cup</option>
          <option value="DEVELOPMENT">Development</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gameFormat" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Game format
        </label>
        <select
          id="gameFormat"
          name="gameFormat"
          required
          defaultValue="ELEVEN_A_SIDE"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
        >
          <option value="THREE_A_SIDE">3-a-side</option>
          <option value="FIVE_A_SIDE">5-a-side</option>
          <option value="SEVEN_A_SIDE">7-a-side</option>
          <option value="NINE_A_SIDE">9-a-side</option>
          <option value="ELEVEN_A_SIDE">11-a-side</option>
        </select>
      </div>

      <SubmitButton />
    </form>
  );
}