"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createMatchAction } from "@/app/(app)/matches/actions";
import { OpponentTeamSelect } from "@/components/opponents/opponent-team-select";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import { getTodayLocalDateInputValue } from "@/lib/date-utils";
import { TouchlineButton } from "@/components/touchline";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <TouchlineButton type="submit" variant="primary" size="lg" disabled={pending}>
      {pending ? "Creating..." : "Create match"}
    </TouchlineButton>
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
  const orgUrl = useOrgUrl();
  const today = getTodayLocalDateInputValue();

  if (teams.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger-subtle)] px-4 py-3 text-sm text-[var(--foreground)]">
        Create at least one team before adding matches.{" "}
        <Link href={orgUrl("/teams/new")} className="underline text-[var(--accent-strong)]">
          Create a team
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error && (
        <div className="rounded-2xl border border-[var(--danger)]/35 bg-[var(--danger-subtle)] px-4 py-3 text-sm text-[var(--foreground)]">
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
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-strong)] focus:outline-none"
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
        onTextChange={(_text) => {
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
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-strong)] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="kickoffTime" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Kick-off time
        </label>
        <input
          id="kickoffTime"
          name="kickoffTime"
          type="time"
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-strong)] focus:outline-none"
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
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-strong)] focus:outline-none"
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
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-strong)] focus:outline-none"
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
          className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--accent-strong)] focus:outline-none"
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