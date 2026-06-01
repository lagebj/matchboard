import { db } from "@/lib/db";
import type { MovementCandidateDriftSignal } from "./movement-candidate";

const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;

export async function detectMovementCandidateDrift(planningPeriodId: string): Promise<MovementCandidateDriftSignal[]> {
  const now = new Date();
  const signals: MovementCandidateDriftSignal[] = [];

  const candidates = await db.movementCandidate.findMany({
    where: { status: "ACTIVE" },
    include: {
      player: {
        select: { id: true, firstName: true, lastName: true, coreTeamId: true },
      },
      rotationPath: {
        select: { id: true, fromTeamId: true, toTeamId: true },
      },
    },
  });

  for (const c of candidates) {
    const base = {
      candidateId: c.id,
      playerId: c.player.id,
      playerFirstName: c.player.firstName,
      playerLastName: c.player.lastName,
    };

    if (c.reviewBy && c.reviewBy < now) {
      signals.push({ ...base, category: "review_overdue", message: "Review overdue" });
    }

    if (!c.reviewBy && (now.getTime() - c.activeFrom.getTime()) > EIGHT_WEEKS_MS) {
      signals.push({ ...base, category: "long_running_candidate", message: "Long-running candidate relationship" });
    }
  }

  const playerIdSet = new Set(candidates.map((c) => c.player.id));

  if (playerIdSet.size > 0) {
    const playerIds = [...playerIdSet];

    const finalizedMovements = await db.movementLedger.findMany({
      where: {
        playerId: { in: playerIds },
        isDraft: false,
        matchRound: { planningPeriodId },
      },
      select: {
        playerId: true,
        fromTeamId: true,
        toTeamId: true,
        matchRoundId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const nonCoreMovementsByPlayer = new Map<string, { rounds: Set<string>; directions: Set<string> }>();
    for (const m of finalizedMovements) {
      if (m.fromTeamId === m.toTeamId) continue;
      const existing = nonCoreMovementsByPlayer.get(m.playerId);
      if (existing) {
        existing.rounds.add(m.matchRoundId);
        existing.directions.add(`${m.fromTeamId}->${m.toTeamId}`);
      } else {
        nonCoreMovementsByPlayer.set(m.playerId, {
          rounds: new Set([m.matchRoundId]),
          directions: new Set([`${m.fromTeamId}->${m.toTeamId}`]),
        });
      }
    }

    for (const [playerId, data] of nonCoreMovementsByPlayer) {
      const player = candidates.find((c) => c.player.id === playerId);
      if (!player) continue;

      const base = {
        candidateId: "",
        playerId,
        playerFirstName: player.player.firstName,
        playerLastName: player.player.lastName,
      };

      if (data.rounds.size >= 3) {
        const candidateForPlayer = candidates.find((c) => c.player.id === playerId);
        signals.push({
          ...base,
          candidateId: candidateForPlayer?.id ?? "",
          category: "repeated_non_core_selection",
          message: "Repeated non-core selection",
        });
      }

      if (data.directions.size === 1) {
        const candidateForPlayer = candidates.find((c) => c.player.id === playerId);
        signals.push({
          ...base,
          candidateId: candidateForPlayer?.id ?? "",
          category: "one_way_movement",
          message: "One-way movement pattern",
        });
      }
    }
  }

  const candidatePlayerIds = [...new Set(candidates.map((c) => c.player.id))];
  if (candidatePlayerIds.length > 0) {
    const usedInRounds = await db.selection.findMany({
      where: {
        playerId: { in: candidatePlayerIds },
        status: "FINALIZED",
        role: { in: ["SUPPORT", "DEVELOPMENT", "BACKFILL"] },
      },
      select: { playerId: true, matchRoundId: true },
    });

    const usedPlayerIds = new Set(usedInRounds.map((s) => s.playerId));

    for (const c of candidates) {
      if (!usedPlayerIds.has(c.player.id)) {
        signals.push({
          candidateId: c.id,
          playerId: c.player.id,
          playerFirstName: c.player.firstName,
          playerLastName: c.player.lastName,
          category: "candidate_never_used",
          message: "Candidate has not been used",
        });
      }
    }
  }

  const teamCoreReplacementSignals = await detectTeamCoreReplacementPattern(planningPeriodId);
  signals.push(...teamCoreReplacementSignals);

  return signals;
}

async function detectTeamCoreReplacementPattern(planningPeriodId: string): Promise<MovementCandidateDriftSignal[]> {
  const signals: MovementCandidateDriftSignal[] = [];

  const teams = await db.team.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
  });

  for (const team of teams) {
    const rounds = await db.matchRound.findMany({
      where: {
        planningPeriodId,
        status: "FINALIZED",
        matches: { some: { teamId: team.id } },
      },
      select: { id: true },
    });

    if (rounds.length < 3) continue;

    const roundIds = rounds.map((r) => r.id);

    const nonCoreReplacements = await db.selection.count({
      where: {
        match: { teamId: team.id },
        matchRoundId: { in: roundIds },
        status: "FINALIZED",
        role: { in: ["SUPPORT", "BACKFILL"] },
        player: { coreTeamId: { not: team.id } },
      },
    });

    if (nonCoreReplacements >= 3) {
      signals.push({
        candidateId: "",
        playerId: team.id,
        playerFirstName: team.name,
        playerLastName: null,
        category: "team_core_replacement",
        message: "Core players repeatedly replaced by candidates",
      });
    }
  }

  return signals;
}