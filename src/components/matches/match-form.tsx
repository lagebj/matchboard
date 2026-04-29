import type { Team } from "@/generated/prisma/client";
import { createMatchAction } from "@/app/matches/actions";
import { getTodayDateInputValue } from "@/lib/date-utils";
import { matchTypeOptions, matchVenueOptions } from "@/lib/player-form-options";
import { DatePickerField } from "@/components/date-picker-field";

export function MatchForm({ teams }: { teams: Pick<Team, "id" | "name">[] }) {
  return (
    <form action={createMatchAction} className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Match Date
          <DatePickerField defaultValue={getTodayDateInputValue()} name="startsAt" />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Target Team
          <select
            className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
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

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Home / Away
          <select
            className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
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

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Opponent
          <input
            className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none placeholder:text-zinc-500"
            name="opponent"
            placeholder="Opponent name"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Squad Size
          <input
            className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
            defaultValue="9"
            min={1}
            name="squadSize"
            required
            type="number"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
          Match Type
          <select
            className="h-10 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 font-normal text-zinc-100 outline-none"
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
      </section>

      <label className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3 text-sm font-medium text-zinc-100">
        <input defaultChecked={false} name="availableForDevelopmentSlot" type="checkbox" />
        Available for development slot work
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
        Notes
        <textarea
          className="min-h-28 rounded-2xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 py-2 font-normal text-zinc-100 outline-none placeholder:text-zinc-500"
          name="notes"
          placeholder="Optional"
        />
      </label>

      <button
        className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        type="submit"
      >
        Create match
      </button>
    </form>
  );
}