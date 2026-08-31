import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { isMatchRoundPlanningEditable } from "@/lib/selection/planning-boundary";

// "Pin" is the coach-facing name for an explicit, round-scoped planning constraint (DECISIONS.md
// "User-facing lifecycle vocabulary": "Use `Pin` for an explicit coach planning constraint").
// The underlying model/field names (`PlayerLock`, `LOCKED_IN`/`LOCKED_OUT`) are read directly by
// the selection engine (`generate-selection.ts`) and are not renamed here — only the coach-facing
// language changes.
export type PinType = "LOCKED_IN" | "LOCKED_OUT";

export type PlayerLockRow = {
  id: string;
  matchRoundId: string;
  playerId: string;
  lockType: PinType;
  reason: string | null;
  lockedBy: string | null;
  createdAt: Date;
};

function toRow(record: { id: string; matchRoundId: string; playerId: string; lockType: string; reason: string | null; lockedBy: string | null; createdAt: Date }): PlayerLockRow {
  return { ...record, lockType: record.lockType as PinType };
}

export async function getPlayerLocksForRound(matchRoundId: string, orgFilter: OrgFilterMode): Promise<PlayerLockRow[]> {
  const records = await db.playerLock.findMany({
    where: { matchRoundId, organisationId: orgFilter.organisationId },
    orderBy: { createdAt: "desc" },
  });
  return records.map(toRow);
}

export async function createPlayerLock(
  input: { matchRoundId: string; playerId: string; lockType: PinType; reason?: string; lockedBy?: string },
  orgFilter: OrgFilterMode,
): Promise<PlayerLockRow> {
  const round = await db.matchRound.findFirst({
    where: { id: input.matchRoundId, organisationId: orgFilter.organisationId },
    select: { id: true },
  });
  if (!round) throw new Error("Match round not found.");

  // A Pin remains valid only while it can still affect a future generation/edit (ADR-0109 §8):
  // once every match's own planning boundary has closed, a Pin can no longer do anything, so the
  // gate is the same real-world boundary as every other planning mutation, not a separate
  // round-FINALIZED check.
  const boundary = await isMatchRoundPlanningEditable(input.matchRoundId);
  if (!boundary.editable) {
    throw new Error(boundary.reason ?? "Cannot pin a player once planning has closed for this round.");
  }

  const player = await db.player.findFirst({
    where: { id: input.playerId, removedAt: null, coreTeam: { organisationId: orgFilter.organisationId } },
  });
  if (!player) throw new Error("Player not found.");

  const record = await db.playerLock.upsert({
    where: { matchRoundId_playerId: { matchRoundId: input.matchRoundId, playerId: input.playerId } },
    create: {
      organisationId: orgFilter.organisationId,
      matchRoundId: input.matchRoundId,
      playerId: input.playerId,
      lockType: input.lockType,
      reason: input.reason?.trim() || null,
      lockedBy: input.lockedBy || null,
    },
    update: {
      lockType: input.lockType,
      reason: input.reason?.trim() || null,
      lockedBy: input.lockedBy || null,
    },
  });

  return toRow(record);
}

export async function deletePlayerLock(matchRoundId: string, playerId: string, orgFilter: OrgFilterMode): Promise<void> {
  const lock = await db.playerLock.findFirst({
    where: { matchRoundId, playerId, organisationId: orgFilter.organisationId },
    select: { id: true },
  });
  if (!lock) return;
  await db.playerLock.delete({ where: { id: lock.id } });
}
