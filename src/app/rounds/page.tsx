import Link from "next/link";
import { db } from "@/lib/db";
import { formatIsoWeekKey, formatIsoWeekLabel } from "@/lib/date-utils";

export default async function RoundsPage() {
  const matchRounds = await db.matchRound.findMany({
    include: {
      matches: {
        select: {
          id: true,
          opponent: true,
          startsAt: true,
          team: { select: { id: true, name: true } },
        },
        orderBy: [{ startsAt: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Round Board
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              All rounds
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
            Pick a round to plan.
          </h1>
          <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
            Open a match round to see all team matches in columns with role buckets and cross-team consequences.
          </p>
        </div>
      </section>

      {matchRounds.length === 0 ? (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
          No match rounds yet. Create a match to start.
        </div>
      ) : (
        <section className="app-panel rounded-[1.75rem] p-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {matchRounds.map((round) => {
              const weekLabel = round.matches.length > 0
                ? formatIsoWeekLabel(round.matches[0]!.startsAt)
                : round.name;
              const teamNames = [...new Set(round.matches.map((m) => m.team.name))];
              const isFinalized = round.status === "FINALIZED";

              return (
                <Link
                  key={round.id}
                  className="rounded-[1.5rem] border p-4 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                  href={`/rounds/${round.id}`}
                  style={
                    isFinalized
                      ? { borderColor: "rgba(140,167,146,0.26)", background: "linear-gradient(180deg,rgba(140,167,146,0.08),rgba(17,22,31,0.82))" }
                      : { borderColor: "rgba(211,203,188,0.1)" }
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-zinc-50">{weekLabel}</p>
                      <p className="mt-1 text-sm app-copy-soft">
                        {round.matches.length} match{round.matches.length !== 1 ? "es" : ""}
                      </p>
                      <p className="mt-2 text-xs app-copy-muted">
                        {teamNames.join(" &middot; ")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${isFinalized ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]" : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"}`}
                    >
                      {isFinalized ? "Finalized" : "Draft"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}