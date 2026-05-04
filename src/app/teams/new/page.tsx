import Link from "next/link";
import { createTeamAction } from "@/app/teams/actions";

type NewTeamPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewTeamPage({ searchParams }: NewTeamPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              New team
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Create team
              </h1>
              <p className="mt-4 text-sm app-copy-soft sm:text-base">
                Add a team to the registry. Squad limits and support config can be adjusted later from the team detail page.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <form action={createTeamAction} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Team name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              placeholder="Team name"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="targetSquadSize" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Target squad size
              </label>
              <input
                id="targetSquadSize"
                name="targetSquadSize"
                type="number"
                required
                min={0}
                defaultValue={11}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="minAcceptedSquadSize" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Min accepted squad size
              </label>
              <input
                id="minAcceptedSquadSize"
                name="minAcceptedSquadSize"
                type="number"
                required
                min={0}
                defaultValue={9}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="maxSquadSize" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Max squad size
              </label>
              <input
                id="maxSquadSize"
                name="maxSquadSize"
                type="number"
                required
                min={0}
                defaultValue={14}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="minCorePlayers" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Min core players
              </label>
              <input
                id="minCorePlayers"
                name="minCorePlayers"
                type="number"
                required
                min={0}
                defaultValue={8}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="supportPriority" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Support priority
              </label>
              <input
                id="supportPriority"
                name="supportPriority"
                type="number"
                required
                min={0}
                defaultValue={0}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="minSupportPlayers" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Min support players
              </label>
              <input
                id="minSupportPlayers"
                name="minSupportPlayers"
                type="number"
                required
                min={0}
                defaultValue={0}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="developmentSlots" className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                Development slots
              </label>
              <input
                id="developmentSlots"
                name="developmentSlots"
                type="number"
                required
                min={0}
                defaultValue={0}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 text-sm text-zinc-100 focus:border-[var(--accent-strong)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))]"
            >
              Create team
            </button>
            <Link
              href="/teams"
              className="inline-flex h-11 items-center rounded-full border app-hairline px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}