import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type TeamRoundDonation = {
  donations: number;
  matchRoundId: string;
  receptions: number;
  supportShortfall: boolean;
  teamId: string;
};

export type TeamBurdenResult = {
  continuityDeltaByRound: Record<string, number>;
  highDonorBurden: boolean;
  repeatedSupportShortfall: boolean;
  teamId: string;
  teamName: string;
  totalDonations: number;
  totalReceptions: number;
  roundDetails: TeamRoundDonation[];
};

export type TeamBurden = {
  teams: TeamBurdenResult[];
  planningPeriodId: string;
};

function isDonorRole(role: SelectionRole): boolean {
  return (
    role === SelectionRole.SUPPORT ||
    role === SelectionRole.BACKFILL ||
    role === SelectionRole.DEVELOPMENT ||
    role === SelectionRole.CONFIDENCE_REBUILD
  );
}

function isReceptionRole(role: SelectionRole): boolean {
  return (
    role === SelectionRole.SUPPORT ||
    role === SelectionRole.BACKFILL ||
    role === SelectionRole.DEVELOPMENT ||
    role === SelectionRole.CONFIDENCE_REBUILD
  );
}

export async function getTeamBurden(
  planningPeriodId: string,
): Promise<TeamBurden> {
  const [matchRounds, matches, teams, selections] = await Promise.all([
    db.matchRound.findMany({
      where: { planningPeriodId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
    db.match.findMany({
      where: { matchRound: { planningPeriodId } },
      select: {
        id: true,
        matchRoundId: true,
        teamId: true,
        team: { select: { id: true, name: true, targetSupportCount: true } },
      },
    }),
    db.team.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        name: true,
        maxPlayerChangesPerRound: true,
      },
    }),
    db.selection.findMany({
      where: {
        status: SelectionStatus.FINALIZED,
        matchRound: { planningPeriodId },
      },
      select: {
        playerId: true,
        matchId: true,
        matchRoundId: true,
        role: true,
        match: {
          select: {
            teamId: true,
            team: {
              select: { id: true, name: true },
            },
          },
        },
        player: {
          select: {
            coreTeamId: true,
          },
        },
      },
    }),
  ]);

  const matchRoundsSorted = matchRounds;

  const results: TeamBurdenResult[] = [];

  for (const team of teams) {
    const roundDetails: TeamRoundDonation[] = [];

    for (const round of matchRoundsSorted) {
      const roundSelections = selections.filter(
        (s) => s.matchRoundId === round.id,
      );

      let donations = 0;
      let receptions = 0;

      for (const sel of roundSelections) {
        if (sel.player.coreTeamId === team.id && isDonorRole(sel.role) && sel.match.teamId !== team.id) {
          donations++;
        }

        if (sel.match.teamId === team.id && isReceptionRole(sel.role) && sel.player.coreTeamId !== team.id) {
          receptions++;
        }
      }

      const roundMatchesForTeam = matches.filter(
        (m) => m.matchRoundId === round.id && m.teamId === team.id,
      );

      let supportShortfall = false;
      for (const matchRecord of roundMatchesForTeam) {
        const targetSupport = matchRecord.team.targetSupportCount ?? 0;
        if (targetSupport > 0) {
          const actualSupport = roundSelections.filter(
            (s) => s.matchId === matchRecord.id && isReceptionRole(s.role) && s.player.coreTeamId !== team.id,
          ).length;
          if (actualSupport < targetSupport) {
            supportShortfall = true;
          }
        }
      }

      roundDetails.push({
        donations,
        matchRoundId: round.id,
        receptions,
        supportShortfall,
        teamId: team.id,
      });
    }

    const totalDonations = roundDetails.reduce((sum, r) => sum + r.donations, 0);
    const totalReceptions = roundDetails.reduce((sum, r) => sum + r.receptions, 0);
    const roundsWithDonation = roundDetails.filter((r) => r.donations > 0).length;
    const highDonorBurden = roundsWithDonation > 0 && roundsWithDonation === matchRoundsSorted.length;

    const roundsWithShortfall = roundDetails.filter((r) => r.supportShortfall).length;
    const repeatedSupportShortfall = roundsWithShortfall >= Math.ceil(matchRoundsSorted.length / 2) && matchRoundsSorted.length > 1;

    const continuityDeltaByRound: Record<string, number> = {};

    for (let i = 1; i < matchRoundsSorted.length; i++) {
      const currentRoundId = matchRoundsSorted[i]!.id;
      const prevRoundId = matchRoundsSorted[i - 1]!.id;

      const currentPlayerIds = new Set(
        selections
          .filter((s) => s.matchRoundId === currentRoundId && s.match.teamId === team.id)
          .map((s) => s.playerId),
      );

      const prevPlayerIds = new Set(
        selections
          .filter((s) => s.matchRoundId === prevRoundId && s.match.teamId === team.id)
          .map((s) => s.playerId),
      );

      let changes = 0;
      for (const pid of currentPlayerIds) {
        if (!prevPlayerIds.has(pid)) changes++;
      }
      for (const pid of prevPlayerIds) {
        if (!currentPlayerIds.has(pid)) changes++;
      }

      continuityDeltaByRound[currentRoundId] = changes;
    }

    results.push({
      continuityDeltaByRound,
      highDonorBurden,
      repeatedSupportShortfall,
      teamId: team.id,
      teamName: team.name,
      totalDonations,
      totalReceptions,
      roundDetails,
    });
  }

  return {
    planningPeriodId,
    teams: results,
  };
}