import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import Link from "next/link";
import { ENVIRONMENT_OBSERVATION_LABELS, CONCERN_CATEGORY_LABELS, FOLLOW_UP_LABELS } from "@/lib/opponents/observation-labels";
import { MATCH_FIT_LABELS } from "@/lib/opponents/match-fit-labels";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ opponentTeamId: string }>;
};

export default async function OpponentDetailPage({ params }: PageProps) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const { opponentTeamId } = await params;

  const opponentTeam = await db.opponentTeam.findFirst({
    where: {
      id: opponentTeamId,
      archivedAt: null,
      ...(orgFilter.type === "org" ? orgFilter.filter : {}),
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  if (!opponentTeam) notFound();

  const matches = await db.match.findMany({
    where: {
      opponentTeamId,
      ...(orgFilter.type === "org" ? orgFilter.filter : {}),
    },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      startsAt: true,
      homeAway: true,
      opponent: true,
      matchFit: true,
      team: { select: { id: true, name: true } },
      opponentObservation: {
        select: {
          overallEnvironment: true,
          concernCategories: true,
          factualSummary: true,
          followUp: true,
        },
      },
    },
  });

  const observations = await db.opponentEncounterObservation.findMany({
    where: { opponentTeamId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      overallEnvironment: true,
      concernCategories: true,
      factualSummary: true,
      followUp: true,
      createdAt: true,
    },
  });

  const totalEncounters = matches.length;
  const observationsRecorded = observations.length;
  const concernEncounters = observations.filter(
    (o) => o.overallEnvironment === "CONCERN" || o.overallEnvironment === "SERIOUS_CONCERN",
  ).length;
  const latestConcernDate = observations.find(
    (o) => o.overallEnvironment === "CONCERN" || o.overallEnvironment === "SERIOUS_CONCERN",
  )?.createdAt;

  const postMatchResults: Record<string, { homeGoals: number | null; awayGoals: number | null } | null> = {};
  const reportIds = await db.postMatchReport.findMany({
    where: { matchId: { in: matches.map((m) => m.id) } },
    select: { matchId: true, homeGoals: true, awayGoals: true },
  });
  for (const r of reportIds) {
    postMatchResults[r.matchId] = { homeGoals: r.homeGoals, awayGoals: r.awayGoals };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/fixtures" className="text-sm text-[var(--accent-strong)] hover:underline">
          &larr; Fixtures
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50">{opponentTeam.displayName}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Encounter history recorded by coaches. Observations describe individual matches and must not be treated as fixed labels.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Encounters recorded</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">{totalEncounters}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Observations recorded</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">{observationsRecorded}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Environment concerns</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">{concernEncounters}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Latest concern</p>
          <p className="mt-1 text-sm text-zinc-50">
            {latestConcernDate ? latestConcernDate.toLocaleDateString() : "\u2014"}
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-zinc-400">No encounter observations recorded for this opponent.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Our team</th>
                <th className="pb-2 pr-4">Opponent</th>
                <th className="pb-2 pr-4">H/A</th>
                <th className="pb-2 pr-4">Result</th>
                <th className="pb-2 pr-4">Sporting fit</th>
                <th className="pb-2 pr-4">Environment</th>
                <th className="pb-2 pr-4">Concerns</th>
                <th className="pb-2 pr-4">Follow-up</th>
                <th className="pb-2">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {matches.map((match) => {
                const obs = match.opponentObservation;
                const result = postMatchResults[match.id];
                return (
                  <tr key={match.id} className="text-zinc-200">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <Link href={`/matches/${match.id}`} className="text-[var(--accent-strong)] hover:underline">
                        {match.startsAt.toLocaleDateString()}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{match.team.name}</td>
                    <td className="py-2 pr-4">{match.opponent}</td>
                    <td className="py-2 pr-4">{match.homeAway === "HOME" ? "Home" : "Away"}</td>
                    <td className="py-2 pr-4">
                      {result && result.homeGoals !== null ? `${result.homeGoals}\u2013${result.awayGoals}` : "\u2014"}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={match.matchFit !== "UNKNOWN" ? "text-zinc-100" : "text-zinc-500"}>
                        {MATCH_FIT_LABELS[match.matchFit as keyof typeof MATCH_FIT_LABELS] ?? "Not assessed"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {obs ? ENVIRONMENT_OBSERVATION_LABELS[obs.overallEnvironment as keyof typeof ENVIRONMENT_OBSERVATION_LABELS] : "\u2014"}
                    </td>
                    <td className="py-2 pr-4">
                      {obs && obs.concernCategories.length > 0
                        ? obs.concernCategories.map((c) => CONCERN_CATEGORY_LABELS[c as keyof typeof CONCERN_CATEGORY_LABELS] ?? c).join(", ")
                        : "\u2014"}
                    </td>
                    <td className="py-2 pr-4">
                      {obs && obs.followUp !== "NONE" ? FOLLOW_UP_LABELS[obs.followUp as keyof typeof FOLLOW_UP_LABELS] : "\u2014"}
                    </td>
                    <td className="py-2 max-w-[200px] truncate" title={obs?.factualSummary ?? undefined}>
                      {obs?.factualSummary ? obs.factualSummary.slice(0, 60) + (obs.factualSummary.length > 60 ? "\u2026" : "") : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}