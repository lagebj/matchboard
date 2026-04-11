import Link from "next/link";
import type { Team } from "@/generated/prisma/client";
import { MatchForm } from "@/components/matches/match-form";

export function MatchCreateLayover({ teams }: { teams: Pick<Team, "id" | "name">[] }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-zinc-950/30">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              New Match
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Create Match
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Add a match without leaving the overview. Create it here, then open the detail page
              when you want to work on selection.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
            href="/matches"
          >
            Close
          </Link>
        </div>

        <MatchForm teams={teams} />
      </div>
    </div>
  );
}
