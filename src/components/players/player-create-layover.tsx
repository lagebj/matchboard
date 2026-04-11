import Link from "next/link";
import type { Team } from "@/generated/prisma/client";
import { createPlayerAction } from "@/app/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";

export function PlayerCreateLayover({ teams }: { teams: Pick<Team, "id" | "name">[] }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-zinc-950/30">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              New Player
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Create Player
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Add a player without leaving the registry. The backend player code is generated
              automatically when the record is created.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
            href="/players"
          >
            Close
          </Link>
        </div>

        <PlayerEditorForm action={createPlayerAction} cancelHref="/players" submitLabel="Create player" teams={teams} />
      </div>
    </div>
  );
}
