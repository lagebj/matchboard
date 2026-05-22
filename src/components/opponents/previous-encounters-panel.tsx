import { db } from "@/lib/db";
import Link from "next/link";
import { ENVIRONMENT_OBSERVATION_LABELS, PREVIOUS_ENCOUNTERS_DISCLAIMER } from "@/lib/opponents/observation-labels";
import { MATCH_FIT_LABELS } from "@/lib/opponents/match-fit-labels";

type Props = {
  opponentTeamId: string;
};

export async function PreviousEncountersPanel({ opponentTeamId }: Props) {
  const previousMatches = await db.match.findMany({
    where: {
      opponentTeamId,
      startsAt: { lt: new Date() },
    },
    orderBy: { startsAt: "desc" },
    take: 3,
    select: {
      id: true,
      startsAt: true,
      homeAway: true,
      team: { select: { name: true } },
      matchFit: true,
      opponentObservation: {
        select: { overallEnvironment: true },
      },
    },
  });

  const totalPrevious = await db.match.count({
    where: {
      opponentTeamId,
      startsAt: { lt: new Date() },
    },
  });

  const concernCount = await db.opponentEncounterObservation.count({
    where: {
      opponentTeamId,
      overallEnvironment: { in: ["CONCERN", "SERIOUS_CONCERN"] },
    },
  });

  const latestConcern = await db.opponentEncounterObservation.findFirst({
    where: {
      opponentTeamId,
      overallEnvironment: { in: ["CONCERN", "SERIOUS_CONCERN"] },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (totalPrevious === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-50">Previous encounters</h3>
        <Link
          href={`/opponents/${opponentTeamId}`}
          className="text-sm text-[var(--accent-strong)] hover:underline"
        >
          View encounter history
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Total matches</p>
          <p className="text-zinc-100 font-medium">{totalPrevious}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Environment concerns</p>
          <p className="text-zinc-100 font-medium">{concernCount}</p>
        </div>
        {latestConcern && (
          <div>
            <p className="text-xs text-zinc-500">Latest concern</p>
            <p className="text-zinc-100 font-medium">{latestConcern.createdAt.toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {previousMatches.length > 0 && (
        <div className="space-y-2">
          {previousMatches.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm border-b border-[var(--border-soft)] pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="text-zinc-400">{m.startsAt.toLocaleDateString()}</span>
                <span className="text-zinc-200">{m.team.name}</span>
                <span className="text-zinc-500">{m.homeAway === "HOME" ? "Home" : "Away"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={m.matchFit !== "UNKNOWN" ? "text-zinc-200" : "text-zinc-500"}>
                  {MATCH_FIT_LABELS[m.matchFit as keyof typeof MATCH_FIT_LABELS] ?? "Not assessed"}
                </span>
                {m.opponentObservation && m.opponentObservation.overallEnvironment !== "NOT_ASSESSED" && (
                  <span className={
                    m.opponentObservation.overallEnvironment === "SERIOUS_CONCERN"
                      ? "text-amber-400"
                      : m.opponentObservation.overallEnvironment === "CONCERN"
                        ? "text-yellow-400"
                        : "text-zinc-400"
                  }>
                    {ENVIRONMENT_OBSERVATION_LABELS[m.opponentObservation.overallEnvironment as keyof typeof ENVIRONMENT_OBSERVATION_LABELS] ?? ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500 italic">
        {PREVIOUS_ENCOUNTERS_DISCLAIMER}
      </p>
    </div>
  );
}