import type { Team } from "@/generated/prisma/client";
import { createMatchAction } from "@/app/matches/actions";
import { getTodayDateInputValue } from "@/lib/date-utils";
import { matchTypeOptions, matchVenueOptions } from "@/lib/player-form-options";

export function MatchForm({ teams }: { teams: Pick<Team, "id" | "name">[] }) {
  return (
    <form
      action={createMatchAction}
      className="flex flex-col gap-4 border border-zinc-200 bg-white p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Create Match</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Create one match and move on to selection from there.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Match Date
        <input
          className="h-10 border border-zinc-300 bg-white px-3 font-normal"
          defaultValue={getTodayDateInputValue()}
          name="startsAt"
          required
          type="date"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Target Team
        <select
          className="h-10 border border-zinc-300 bg-white px-3 font-normal"
          defaultValue={teams[0]?.id}
          name="targetTeamId"
          required
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Home / Away
        <select
          className="h-10 border border-zinc-300 bg-white px-3 font-normal"
          defaultValue={matchVenueOptions[0].value}
          name="homeOrAway"
          required
        >
          {matchVenueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Opponent
        <input
          className="h-10 border border-zinc-300 px-3 font-normal"
          name="opponent"
          placeholder="Opponent name"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Squad Size
        <input
          className="h-10 border border-zinc-300 px-3 font-normal"
          defaultValue="9"
          min={1}
          name="squadSize"
          required
          type="number"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          defaultChecked={false}
          name="availableForDevelopmentSlot"
          type="checkbox"
        />
        Available for development slot work
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Match Type
        <select
          className="h-10 border border-zinc-300 px-3 font-normal"
          defaultValue={matchTypeOptions[0].value}
          name="matchType"
        >
          {matchTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes
        <textarea
          className="min-h-28 border border-zinc-300 px-3 py-2 font-normal"
          name="notes"
          placeholder="Optional"
        />
      </label>

      <button
        className="mt-2 h-10 rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
        type="submit"
      >
        Create match
      </button>
    </form>
  );
}
