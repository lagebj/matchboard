"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
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
  const [dateValue, setDateValue] = useState(today);
  const [timeValue, setTimeValue] = useState("");

  // The coach enters the kick-off time they see on their own watch. Computing the resulting
  // instant here (in the browser) — rather than in the createMatchAction Server Action, which
  // executes on Vercel in UTC — means the browser's own local timezone (the coach's real
  // timezone) is what resolves "17:30" to a true UTC instant, exactly like match-edit-form.tsx
  // already does for rescheduling. Doing this server-side instead was the actual bug behind
  // "Start live reporting" staying hidden well past real kickoff: the server treated the typed
  // digits as UTC, storing a kickoff up to the coach's UTC offset (1-2h for Norway) *later* than
  // reality.
  const startsAtIso = useMemo(() => {
    if (!dateValue) return "";
    const [year, month, day] = dateValue.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
    let hours = 12;
    let minutes = 0;
    if (timeValue) {
      const parts = timeValue.split(":").map(Number);
      hours = parts[0] ?? 0;
      minutes = parts[1] ?? 0;
    }
    const parsed = new Date(year, month - 1, day, hours, minutes, 0);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString();
  }, [dateValue, timeValue]);

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

      {/* Computed in the browser from the two visible fields (see startsAtIso above) — the
          actual source of truth submitted to createMatchAction. startsAt/kickoffTime remain as
          a same-timezone fallback for a no-JS submission. */}
      <input type="hidden" name="startsAtIso" value={startsAtIso} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="startsAt" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Match date
        </label>
        <input
          id="startsAt"
          name="startsAt"
          type="date"
          required
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
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
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
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