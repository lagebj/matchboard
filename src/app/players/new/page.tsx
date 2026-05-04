export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { createPlayerAction } from "@/app/players/actions";
import { PlayerEditorForm } from "@/components/players/player-editor-form";

export default async function NewPlayerPage() {
  const teams = await db.team.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (teams.length === 0) {
    return (
      <main className="flex min-h-full flex-col gap-8 text-foreground">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Create player
            </h1>
            <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
              Create at least one team before adding players.{" "}
              <Link href="/teams/new" className="underline text-[var(--accent-strong)]">
                Create a team
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              New player
            </span>
          </div>

          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              Create player
            </h1>
            <p className="mt-4 text-sm app-copy-soft sm:text-base">
              Add a player to the registry. The player code is generated automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <PlayerEditorForm
          action={createPlayerAction}
          cancelHref="/players"
          submitLabel="Create player"
          teams={teams}
        />
      </section>
    </main>
  );
}