export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { formatIsoWeekLabel } from "@/lib/date-utils";
import { RoundListClient } from "./round-list-client";
import { severityFromCode, severityFromDbSeverity } from "@/components/ui/severity-badge";
import { type WarningSeverity } from "@/generated/prisma/client";
import { deriveRoundStatus, type RoundStatus } from "@/lib/round-status";

type RoundItem = {
  id: string;
  name: string;
  weekLabel: string;
  matchCount: number;
  teamNames: string[];
  derivedStatus: RoundStatus;
};

export default async function RoundsPage() {
  const activePlanningPeriod = await db.planningPeriod.findFirst({
    orderBy: { startDate: "desc" },
  });

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
      warnings: {
        where: { resolved: false },
        select: { severity: true, rule: true },
      },
      selections: {
        where: { status: "DRAFT" },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const roundItems: RoundItem[] = matchRounds.map((round) => {
    const blockingCount = round.warnings.filter((w) => (w.severity ? severityFromDbSeverity(w.severity as WarningSeverity) : severityFromCode(w.rule)) === "blocking").length;
    const hasDraftSelections = round.selections.length > 0;
    const hasMatches = round.matches.length > 0;

    return {
      id: round.id,
      name: round.name,
      weekLabel: round.matches.length > 0
        ? formatIsoWeekLabel(round.matches[0]!.startsAt)
        : round.name,
      matchCount: round.matches.length,
      teamNames: [...new Set(round.matches.map((m) => m.team.name))],
      derivedStatus: deriveRoundStatus({ dbStatus: round.status, hasDraftSelections, hasMatches, blockingWarningCount: blockingCount }),
    };
  });

  return (
    <main className="flex min-h-full flex-col gap-6 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Rounds
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Generate, review, and finalize
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
            Rounds
          </h1>
          <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
            Generate, review, and finalize squads per match round.
          </p>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <RoundListClient
          rounds={roundItems}
          activePlanningPeriodId={activePlanningPeriod?.id ?? null}
          hasDraftRounds={roundItems.some((r) => r.derivedStatus === "DRAFT" || r.derivedStatus === "BLOCKED" || r.derivedStatus === "READY")}
          hasNotGeneratedRounds={roundItems.some((r) => r.derivedStatus === "NOT_GENERATED")}
          roundCount={roundItems.length}
        />
      </section>
    </main>
  );
}