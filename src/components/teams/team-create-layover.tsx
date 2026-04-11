import Link from "next/link";
import { createTeamAction } from "@/app/teams/actions";

export function TeamCreateLayover() {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-zinc-950/30">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              New Team
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Create Team
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Add a team without leaving the team registry. Support and development source teams can
              be configured after the team exists.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
            href="/teams"
          >
            Close
          </Link>
        </div>

        <form action={createTeamAction} className="flex flex-col gap-4 border border-zinc-200 bg-white p-5">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Team Name
            <input
              className="h-10 border border-zinc-300 bg-white px-3 font-normal"
              name="name"
              placeholder="Team name"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Minimum Support Players
            <input
              className="h-10 border border-zinc-300 bg-white px-3 font-normal"
              defaultValue="0"
              min={0}
              name="minSupportPlayers"
              required
              type="number"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Development Slots
            <input
              className="h-10 border border-zinc-300 bg-white px-3 font-normal"
              defaultValue="0"
              min={0}
              name="developmentSlots"
              required
              type="number"
            />
          </label>

          <button
            className="h-10 rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
            type="submit"
          >
            Create team
          </button>
        </form>
      </div>
    </div>
  );
}
