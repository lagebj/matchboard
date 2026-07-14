import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Opponent teams" };

export default async function OpponentsPage() {
  await requireCoachAccess();

  const opponentTeams = await db.opponentTeam.findMany({
    where: { archivedAt: null },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      _count: {
        select: {
          matches: true,
          eventMatches: true,
        },
      },
    },
  });

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <PageHeader
        title="Opponent teams"
        description="Reusable opponent teams linked across matches and events."
      />

      {opponentTeams.length === 0 ? (
        <Surface variant="default" padding="lg">
          <p className="text-sm text-zinc-400">No opponent teams yet. They are created automatically when you add matches or event matches.</p>
        </Surface>
      ) : (
        <Surface variant="default" padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 pr-4">Opponent team</th>
                  <th className="px-4 py-3 pr-4">League matches</th>
                  <th className="px-4 py-3">Event matches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {opponentTeams.map((ot) => (
                  <tr key={ot.id} className="text-zinc-200 hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3 pr-4">
                      <Link href={`/opponents/${ot.id}`} className="text-[var(--accent-strong)] hover:underline">
                        {ot.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 pr-4 text-zinc-300">
                      {ot._count.matches}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {ot._count.eventMatches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}
    </main>
  );
}