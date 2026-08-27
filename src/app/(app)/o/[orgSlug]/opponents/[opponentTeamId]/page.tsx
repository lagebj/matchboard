import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import Link from "next/link";
import { ENVIRONMENT_OBSERVATION_LABELS, CONCERN_CATEGORY_LABELS, FOLLOW_UP_LABELS } from "@/lib/opponents/observation-labels";
import { PLAYING_STYLE_TAG_LABELS } from "@/lib/opponents/playing-style-tags";
import { MATCH_FIT_LABELS } from "@/lib/opponents/match-fit-labels";
import { getOpponentSportingEvidence } from "@/lib/opponents/sporting-level-recording";
import { aggregateSportingLevel } from "@/lib/opponents/sporting-level-aggregation";
import { getOpponentCombinationEvidence } from "@/lib/evidence/combination-aggregation";
import { SportingLevelSection } from "@/components/opponents/sporting-level-section";
import { OpponentCombinationEvidenceSection } from "@/components/opponents/opponent-combination-evidence-section";
import { ResponsiveTable, ResponsiveTableCard } from "@/components/ui/responsive-table";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string; opponentTeamId: string }>;
};

export default async function OpponentDetailPage({ params }: PageProps) {
  const { orgSlug, opponentTeamId } = await params;

  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);

  const opponentTeam = await db.opponentTeam.findFirst({
    where: {
      id: opponentTeamId,
      archivedAt: null,
      ...ctx.orgFilter.filter,
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
      ...ctx.orgFilter.filter,
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
          playingStyleTags: true,
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
      playingStyleTags: true,
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

  let sportingLevelData: {
    aggregate: {
      estimatedLevel: number;
      confidence: string;
      validEncounterCount: number;
      lastEncounterDate: string | null;
      gameFormat: string | null;
    } | null;
    evidence: Array<{
      id: string;
      matchId: string;
      occurredAt: string;
      gameFormat: string | null;
      goalsFor: number;
      goalsAgainst: number;
      fieldedRatingSnapshot: number | null;
      estimate: number;
      excludedAt: string | null;
      exclusionReason: string | null;
      weightingMethod: string;
      formulaVersion: string;
    }>;
  } = { aggregate: null, evidence: [] };

  const combinationSummaries = await getOpponentCombinationEvidence(opponentTeamId);
  const combinationPlayerIds = [...new Set(combinationSummaries.flatMap((s) => s.playerIds))];
  const combinationPlayers = combinationPlayerIds.length > 0
    ? await db.player.findMany({
        where: { id: { in: combinationPlayerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const combinationPlayerNameById = new Map(
    combinationPlayers.map((p) => [p.id, `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`]),
  );

  const evidenceRecords = await getOpponentSportingEvidence(opponentTeamId, ctx.orgFilter);
  const aggregate = aggregateSportingLevel(evidenceRecords as Parameters<typeof aggregateSportingLevel>[0]);

  sportingLevelData = {
    aggregate: aggregate
      ? {
          estimatedLevel: aggregate.estimatedLevel,
          confidence: aggregate.confidence,
          validEncounterCount: aggregate.validEncounterCount,
          lastEncounterDate: aggregate.lastEncounterDate?.toISOString() ?? null,
          gameFormat: aggregate.gameFormat,
        }
      : null,
    evidence: evidenceRecords.map((e) => ({
      id: e.id,
      matchId: e.matchId,
      occurredAt: e.occurredAt.toISOString(),
      gameFormat: e.gameFormat,
      goalsFor: e.goalsFor,
      goalsAgainst: e.goalsAgainst,
      fieldedRatingSnapshot: e.fieldedRatingSnapshot ? Number(e.fieldedRatingSnapshot) : null,
      estimate: Number(e.estimate),
      excludedAt: e.excludedAt ? e.excludedAt.toISOString() : null,
      exclusionReason: e.exclusionReason,
      weightingMethod: e.weightingMethod,
      formulaVersion: e.formulaVersion,
    })),
  };

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

      <SportingLevelSection
        opponentTeamId={opponentTeamId}
        initialAggregate={sportingLevelData.aggregate}
        initialEvidence={sportingLevelData.evidence}
      />

      <OpponentCombinationEvidenceSection
        summaries={combinationSummaries}
        playerNameById={Object.fromEntries(combinationPlayerNameById)}
      />

      {matches.length === 0 ? (
        <p className="text-sm text-zinc-400">No encounter observations recorded for this opponent.</p>
      ) : (
        <div>
          <h2 className="text-xl font-semibold text-zinc-50 mb-3">Encounter history</h2>
          <ResponsiveTable
            items={matches}
            getKey={(match) => match.id}
            renderTable={() => (
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
                        <th className="pb-2 pr-4">Style</th>
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
                            {obs && obs.playingStyleTags.length > 0
                              ? obs.playingStyleTags.map((t) => PLAYING_STYLE_TAG_LABELS[t as keyof typeof PLAYING_STYLE_TAG_LABELS] ?? t).join(", ")
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
            renderCard={(match) => {
              const obs = match.opponentObservation;
              const result = postMatchResults[match.id];
              return (
                <ResponsiveTableCard
                  title={match.startsAt.toLocaleDateString()}
                  titleHref={`/matches/${match.id}`}
                  fields={[
                    { label: "Our team", value: match.team.name },
                    { label: "Opponent", value: match.opponent },
                    { label: "H/A", value: match.homeAway === "HOME" ? "Home" : "Away" },
                    {
                      label: "Result",
                      value: result && result.homeGoals !== null ? `${result.homeGoals}\u2013${result.awayGoals}` : "\u2014",
                    },
                    {
                      label: "Sporting fit",
                      value: MATCH_FIT_LABELS[match.matchFit as keyof typeof MATCH_FIT_LABELS] ?? "Not assessed",
                    },
                    {
                      label: "Environment",
                      value: obs ? ENVIRONMENT_OBSERVATION_LABELS[obs.overallEnvironment as keyof typeof ENVIRONMENT_OBSERVATION_LABELS] : "\u2014",
                    },
                    {
                      label: "Concerns",
                      value:
                        obs && obs.concernCategories.length > 0
                          ? obs.concernCategories.map((c) => CONCERN_CATEGORY_LABELS[c as keyof typeof CONCERN_CATEGORY_LABELS] ?? c).join(", ")
                          : "\u2014",
                    },
                    {
                      label: "Style",
                      value:
                        obs && obs.playingStyleTags.length > 0
                          ? obs.playingStyleTags.map((t) => PLAYING_STYLE_TAG_LABELS[t as keyof typeof PLAYING_STYLE_TAG_LABELS] ?? t).join(", ")
                          : "\u2014",
                    },
                    {
                      label: "Follow-up",
                      value: obs && obs.followUp !== "NONE" ? FOLLOW_UP_LABELS[obs.followUp as keyof typeof FOLLOW_UP_LABELS] : "\u2014",
                    },
                    { label: "Summary", value: obs?.factualSummary || "\u2014" },
                  ]}
                />
              );
            }}
          />
        </div>
      )}
    </div>
  );
}