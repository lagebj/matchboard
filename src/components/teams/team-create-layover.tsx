import Link from "next/link";
import { createTeamAction } from "@/app/teams/actions";

export function TeamCreateLayover() {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-[rgba(6,8,12,0.68)] backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l app-hairline bg-[linear-gradient(180deg,rgba(17,21,29,0.98),rgba(11,14,20,0.98))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              New Team
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
              Create Team
            </h2>
            <p className="mt-2 text-sm leading-6 app-copy-soft">
              Add a team without leaving the team registry. Support and development source teams can
              be configured after the team exists.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href="/teams"
          >
            Close
          </Link>
        </div>

        <form action={createTeamAction} className="app-panel flex flex-col gap-4 rounded-[1.5rem] p-5">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
            Team Name
            <input
              className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
              name="name"
              placeholder="Team name"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
            Minimum Support Players
            <input
              className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
              defaultValue="0"
              min={0}
              name="minSupportPlayers"
              required
              type="number"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-100">
            Development Slots
            <input
              className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
              defaultValue="0"
              min={0}
              name="developmentSlots"
              required
              type="number"
            />
          </label>

          <button
            className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            type="submit"
          >
            Create team
          </button>
        </form>
      </div>
    </div>
  );
}
