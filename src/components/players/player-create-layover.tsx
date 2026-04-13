import Link from "next/link";
import type { Team } from "@/generated/prisma/client";
import { createPlayerAction } from "@/app/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";

export function PlayerCreateLayover({ teams }: { teams: Pick<Team, "id" | "name">[] }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-[rgba(6,8,12,0.68)] backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l app-hairline bg-[linear-gradient(180deg,rgba(17,21,29,0.98),rgba(11,14,20,0.98))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              New Player
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
              Create Player
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 app-copy-soft">
              Add a player without leaving the registry. The backend player code is generated
              automatically when the record is created.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            href="/players"
          >
            Close
          </Link>
        </div>

        <PlayerEditorForm
          action={createPlayerAction}
          cancelHref="/players"
          submitLabel="Create player"
          teams={teams}
        />
      </div>
    </div>
  );
}
