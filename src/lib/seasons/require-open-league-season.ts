import { db } from "@/lib/db";
import { AppError } from "@/lib/security/errors";

export class FinalizedLeagueSeasonError extends AppError {
  constructor(message: string = "Cannot modify a finalised league season.") {
    super("CONFLICT", 409, message);
    this.name = "FinalizedLeagueSeasonError";
  }
}

export async function requireOpenLeagueSeason(
  leagueSeasonId: string,
): Promise<void> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { status: true },
  });

  if (!leagueSeason) {
    throw new FinalizedLeagueSeasonError("League season not found.");
  }

  if (leagueSeason.status === "FINALIZED") {
    throw new FinalizedLeagueSeasonError(
      "Cannot modify a finalised league season. Unfinalise the league season first.",
    );
  }
}

export async function requireOpenLeagueSeasonForRound(
  matchRoundId: string,
): Promise<void> {
  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: { leagueSeasonId: true },
  });

  if (!matchRound) {
    throw new FinalizedLeagueSeasonError("Match round not found.");
  }

  await requireOpenLeagueSeason(matchRound.leagueSeasonId);
}

export async function requireOpenLeagueSeasonForMatch(
  matchId: string,
): Promise<void> {
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: { matchRound: { select: { leagueSeasonId: true } } },
  });

  if (!match) {
    throw new FinalizedLeagueSeasonError("Match not found.");
  }

  await requireOpenLeagueSeason(match.matchRound.leagueSeasonId);
}

export async function isLeagueSeasonFinalized(
  leagueSeasonId: string,
): Promise<boolean> {
  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { status: true },
  });
  return leagueSeason?.status === "FINALIZED";
}