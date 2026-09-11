import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import Link from "next/link";
import { TouchlinePageHeader } from "@/components/touchline";
import { Surface } from "@/components/ui/surface";
import { ResponsiveTable, ResponsiveTableCard } from "@/components/ui/responsive-table";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Opponent teams" };

export default async function OpponentsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const opponentTeams = await db.opponentTeam.findMany({
    where: {
      archivedAt: null,
      ...ctx.orgFilter.filter,
    },
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
    // Touchline island (dark-pinned during the phased migration — ADR-0134 Phase 8).
    <main className="touchline flex min-h-full flex-col gap-6" data-theme="dark">
      <TouchlinePageHeader
        title="Opponent teams"
        context="Encountered opponents created from completed post-match reports."
      />

      {opponentTeams.length === 0 ? (
        <Surface variant="default" padding="lg">
          <p className="text-sm text-[var(--text-muted)]">No opponent teams yet. Opponent profiles are created automatically when post-match reports are completed.</p>
        </Surface>
      ) : (
        <Surface variant="default" padding="none">
          <ResponsiveTable
            items={opponentTeams}
            getKey={(ot) => ot.id}
            cardListClassName="p-3"
            renderTable={() => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)] text-left text-xs font-medium text-[var(--text-muted)]">
                      <th className="px-4 py-3 pr-4">Opponent team</th>
                      <th className="px-4 py-3 pr-4">League matches</th>
                      <th className="px-4 py-3">Event matches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-soft)]">
                    {opponentTeams.map((ot) => (
                      <tr key={ot.id} className="text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
                        <td className="px-4 py-3 pr-4">
                          <Link href={`/o/${orgSlug}/opponents/${ot.id}`} className="text-[var(--accent-strong)] hover:underline">
                            {ot.displayName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 pr-4 text-[var(--text-soft)]">
                          {ot._count.matches}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-soft)]">
                          {ot._count.eventMatches}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            renderCard={(ot) => (
              <ResponsiveTableCard
                title={ot.displayName}
                titleHref={`/o/${orgSlug}/opponents/${ot.id}`}
                fields={[
                  { label: "League matches", value: ot._count.matches },
                  { label: "Event matches", value: ot._count.eventMatches },
                ]}
              />
            )}
          />
        </Surface>
      )}
    </main>
  );
}