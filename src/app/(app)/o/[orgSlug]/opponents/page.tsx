import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import Link from "next/link";
import { TouchlinePageHeader } from "@/components/touchline";
import { Surface } from "@/components/ui/surface";
import { ResponsiveTable, ResponsiveTableCard } from "@/components/ui/responsive-table";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { aggregateSportingLevel } from "@/lib/opponents/sporting-level-aggregation";
import { aggregateOpponentEncounters } from "@/lib/opponents/aggregate-opponent-encounters";
import { FOLLOW_UP_LABELS } from "@/lib/opponents/observation-labels";
import { formatDateInDisplayTimezone } from "@/lib/date-utils";
import { buildOpponentsViewModel, type OpponentRowInput } from "@/lib/touchline/presentation/opponents-view-model";

export const dynamic = "force-dynamic";

export const metadata = { title: "Opponent teams" };

const LEVEL_LABEL: Record<string, string> = { unknown: "Not assessed", low: "Low", medium: "Medium", high: "High" };
const RESULT_LABEL: Record<string, string> = { won: "Won", lost: "Lost", drawn: "Drawn" };

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

  const opponentIds = opponentTeams.map((ot) => ot.id);

  // Touchline Design Atlas (ADR-0136 Phase 6, `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md
  // §A`): three batched queries across every opponent, not one query per opponent -- avoids the
  // N+1 that a per-opponent call to `getOpponentSportingEvidence()`/`getOpponentHistory()` would
  // introduce. `getOpponentHistory()` itself is not reused here (it requires a specific
  // `footballGroupId`, unlike this org-wide page -- the same league-season-scope class of trap
  // found for History; see the provenance doc for the full account).
  const [matches, sportingEvidence, latestObservations] = await Promise.all([
    db.match.findMany({
      where: { opponentTeamId: { in: opponentIds }, ...ctx.orgFilter.filter },
      select: { id: true, opponentTeamId: true, startsAt: true, homeAway: true },
      orderBy: { startsAt: "desc" },
    }),
    db.opponentSportingEvidence.findMany({
      where: { opponentTeamId: { in: opponentIds }, ...ctx.orgFilter.filter },
    }),
    db.opponentEncounterObservation.findMany({
      where: { opponentTeamId: { in: opponentIds }, ...ctx.orgFilter.filter },
      orderBy: { createdAt: "desc" },
      select: { opponentTeamId: true, followUp: true },
    }),
  ]);

  // PostMatchReport has no back-relation declared on Match -- one extra batched query joined by
  // matchId in-memory, matching the existing opponent detail page's own established pattern.
  const reports = await db.postMatchReport.findMany({
    where: { matchId: { in: matches.map((m) => m.id) }, status: { in: ["REPORTED", "LOCKED"] } },
    select: { matchId: true, homeGoals: true, awayGoals: true },
  });
  const reportByMatchId = new Map(reports.map((r) => [r.matchId, r]));

  const evidenceByOpponentId = new Map<string, typeof sportingEvidence>();
  for (const e of sportingEvidence) {
    const existing = evidenceByOpponentId.get(e.opponentTeamId);
    if (existing) existing.push(e);
    else evidenceByOpponentId.set(e.opponentTeamId, [e]);
  }

  const latestFollowUpByOpponentId = new Map<string, string>();
  for (const o of latestObservations) {
    if (!latestFollowUpByOpponentId.has(o.opponentTeamId)) {
      latestFollowUpByOpponentId.set(o.opponentTeamId, o.followUp);
    }
  }

  const rowsByOpponentId = aggregateOpponentEncounters(
    matches.map((match) => {
      const report = reportByMatchId.get(match.id);
      return {
        opponentTeamId: match.opponentTeamId,
        startsAt: match.startsAt,
        homeAway: match.homeAway,
        reportHomeGoals: report?.homeGoals ?? null,
        reportAwayGoals: report?.awayGoals ?? null,
        hasReport: report !== undefined,
      };
    }),
  );

  const opponentRows: OpponentRowInput[] = opponentTeams.map((ot) => {
    const row = rowsByOpponentId.get(ot.id);
    const aggregate = aggregateSportingLevel(evidenceByOpponentId.get(ot.id) ?? []);
    return {
      opponentTeamId: ot.id,
      displayName: ot.displayName,
      encounterCount: row?.encounterCount ?? 0,
      lastEncounterDate: row?.lastEncounterDate ?? null,
      lastEncounterResult: row?.lastEncounterResult ?? null,
      sportingLevel: aggregate?.confidence ?? "unknown",
      latestFollowUp: latestFollowUpByOpponentId.get(ot.id) ?? null,
    };
  });

  const viewModel = buildOpponentsViewModel({ opponents: opponentRows, nowIso: new Date().toISOString() });

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8). Composition per
    // the Touchline Design Atlas (ADR-0136 Phase 6, `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_
    // SEASON.md §A`): header+filters -> feature summary widgets -> table (opponent/encounters/
    // sporting level/last encounter/evidence note). No invented percentage strength score --
    // `sportingLevel` is the real categorical confidence estimate (unknown/low/medium/high), see
    // provenance §0 item 7.
    <main className="touchline flex min-h-full flex-col gap-6">
      <TouchlinePageHeader
        title="Opponent teams"
        context="Encountered opponents created from completed post-match reports."
      />

      {opponentTeams.length === 0 ? (
        <Surface variant="default" padding="lg">
          <p className="text-sm text-[var(--text-muted)]">No opponent teams yet. Opponent profiles are created automatically when post-match reports are completed.</p>
        </Surface>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 medium:max-w-[420px]">
            <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-3.5">
              <p className="tl-sport text-[22px] font-[650] text-[var(--foreground)]">{viewModel.recentlyFacedCount}</p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Recently faced</p>
            </div>
            <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-3.5">
              <p className="tl-sport text-[22px] font-[650] text-[var(--foreground)]">{viewModel.needsFollowUpCount}</p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Needs follow-up</p>
            </div>
          </div>

          <Surface variant="default" padding="none">
            <ResponsiveTable
              items={viewModel.opponents}
              getKey={(o) => o.opponentTeamId}
              cardListClassName="p-3"
              renderTable={() => (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-soft)] text-left text-xs font-medium text-[var(--text-muted)]">
                        <th className="px-4 py-3 pr-4">Opponent team</th>
                        <th className="px-4 py-3 pr-4">Encounters</th>
                        <th className="px-4 py-3 pr-4">Sporting level</th>
                        <th className="px-4 py-3 pr-4">Last encounter</th>
                        <th className="px-4 py-3">Evidence note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)]">
                      {viewModel.opponents.map((o) => (
                        <tr key={o.opponentTeamId} className="text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-3 pr-4">
                            <Link href={`/o/${orgSlug}/opponents/${o.opponentTeamId}`} className="text-[var(--accent-strong)] hover:underline">
                              {o.displayName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 pr-4 text-[var(--text-soft)]">{o.encounterCount}</td>
                          <td className="px-4 py-3 pr-4 text-[var(--text-soft)]">{LEVEL_LABEL[o.sportingLevel]}</td>
                          <td className="px-4 py-3 pr-4 text-[var(--text-soft)]">
                            {o.lastEncounterDate ? (
                              <>
                                {formatDateInDisplayTimezone(new Date(o.lastEncounterDate))}
                                {o.lastEncounterResult ? ` · ${RESULT_LABEL[o.lastEncounterResult]}` : ""}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-soft)]">
                            {o.latestFollowUp && o.latestFollowUp !== "NONE"
                              ? FOLLOW_UP_LABELS[o.latestFollowUp as keyof typeof FOLLOW_UP_LABELS] ?? o.latestFollowUp
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              renderCard={(o) => (
                <ResponsiveTableCard
                  title={o.displayName}
                  titleHref={`/o/${orgSlug}/opponents/${o.opponentTeamId}`}
                  fields={[
                    { label: "Encounters", value: o.encounterCount },
                    { label: "Sporting level", value: LEVEL_LABEL[o.sportingLevel] },
                    {
                      label: "Last encounter",
                      value: o.lastEncounterDate
                        ? `${formatDateInDisplayTimezone(new Date(o.lastEncounterDate))}${o.lastEncounterResult ? ` · ${RESULT_LABEL[o.lastEncounterResult]}` : ""}`
                        : "—",
                    },
                    {
                      label: "Evidence note",
                      value:
                        o.latestFollowUp && o.latestFollowUp !== "NONE"
                          ? FOLLOW_UP_LABELS[o.latestFollowUp as keyof typeof FOLLOW_UP_LABELS] ?? o.latestFollowUp
                          : "—",
                    },
                  ]}
                />
              )}
            />
          </Surface>
        </>
      )}
    </main>
  );
}
