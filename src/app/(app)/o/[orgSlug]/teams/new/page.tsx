import { requirePageActorContext } from "@/lib/auth/actor-context";
import { createTeamAction } from "@/app/(app)/teams/actions";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { PageHeader } from "@/components/ui/page-header";

type NewTeamPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewTeamPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: NewTeamPageProps["searchParams"] }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);
  const { error } = await searchParams;

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <PageHeader
        title="Create team"
        description="Add a team to the registry. Squad limits and support config can be adjusted later from the team detail page."
      />

      <Surface variant="default" padding="lg">
        <form action={createTeamAction} className="flex flex-col gap-5">
          {error && <DecisionBanner variant="blocked" title={error} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Team name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              placeholder="Team name"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="targetSquadSize" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Target squad size
              </label>
              <input
                id="targetSquadSize"
                name="targetSquadSize"
                type="number"
                required
                min={0}
                defaultValue={11}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="minAcceptedSquadSize" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Min accepted squad size
              </label>
              <input
                id="minAcceptedSquadSize"
                name="minAcceptedSquadSize"
                type="number"
                required
                min={0}
                defaultValue={9}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="maxSquadSize" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Max squad size
              </label>
              <input
                id="maxSquadSize"
                name="maxSquadSize"
                type="number"
                required
                min={0}
                defaultValue={14}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="minCorePlayers" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Min core players
              </label>
              <input
                id="minCorePlayers"
                name="minCorePlayers"
                type="number"
                required
                min={0}
                defaultValue={8}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="supportPriority" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Support priority rank (1 is highest)
              </label>
              <input
                id="supportPriority"
                name="supportPriority"
                type="number"
                required
                min={0}
                defaultValue={0}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="minSupportPlayers" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Min support players
              </label>
              <input
                id="minSupportPlayers"
                name="minSupportPlayers"
                type="number"
                required
                min={0}
                defaultValue={0}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="developmentSlots" className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Development slots
              </label>
              <input
                id="developmentSlots"
                name="developmentSlots"
                type="number"
                required
                min={0}
                defaultValue={0}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="primary" size="md" type="submit">
              Create team
            </Button>
            <Button variant="ghost" size="md" as="a" href={`/o/${orgSlug}/teams`}>
              Cancel
            </Button>
          </div>
        </form>
      </Surface>
    </main>
  );
}