import { db } from "@/lib/db";
import { normalizeOpponentName, cleanOpponentDisplayName } from "./opponent-team";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

/**
 * Resolve or create a canonical OpponentTeam when a report is completed.
 *
 * This is the single place where OpponentTeam entities are created.
 * Fixture creation stores only a display name snapshot; the canonical
 * entity is linked here when the encounter becomes historical reality.
 *
 * Rules:
 * - If the match/event already has opponentTeamId set, keep it (already linked).
 * - If no opponentTeamId, resolve by normalised name:
 *   - Exact normalised match → reuse existing OpponentTeam
 *   - No exact match → create new OpponentTeam
 * - Always preserve the fixture's opponent/opponentName snapshot text.
 * - Exact normalised matching only — no fuzzy merging.
 * - This function is idempotent; calling it multiple times is safe.
 */
export async function resolveOpponentOnReportCompletion(
  matchId: string,
  orgFilter?: OrgFilterMode,
): Promise<string | null> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...(orgFilter ? orgFilter.filter : {}) },
    select: { id: true, opponent: true, opponentTeamId: true, organisationId: true },
  });
  if (!match) return null;

  if (match.opponentTeamId) return match.opponentTeamId;

  const snapshotName = match.opponent;
  if (!snapshotName || snapshotName.trim().length === 0) return null;

  const normalizedName = normalizeOpponentName(snapshotName);
  const displayName = cleanOpponentDisplayName(snapshotName);

  const opponentTeam = await db.opponentTeam.upsert({
    where: { organisationId_normalizedName: { organisationId: match.organisationId, normalizedName } },
    create: { displayName, normalizedName, organisationId: match.organisationId },
    update: { displayName },
  });

  await db.match.update({
    where: { id: matchId },
    data: { opponentTeamId: opponentTeam.id },
  });

  return opponentTeam.id;
}

/**
 * Resolve or create a canonical OpponentTeam for an event match report completion.
 */
export async function resolveEventOpponentOnReportCompletion(
  eventMatchId: string,
  orgFilter?: OrgFilterMode,
): Promise<string | null> {
  const eventMatch = await db.eventMatch.findFirst({
    where: { id: eventMatchId, ...(orgFilter ? { event: orgFilter.filter } : {}) },
    select: { id: true, opponentName: true, opponentTeamId: true, event: { select: { organisationId: true } } },
  });
  if (!eventMatch) return null;

  if (eventMatch.opponentTeamId) return eventMatch.opponentTeamId;

  const snapshotName = eventMatch.opponentName;
  if (!snapshotName || snapshotName.trim().length === 0) return null;

  const normalizedName = normalizeOpponentName(snapshotName);
  const displayName = cleanOpponentDisplayName(snapshotName);

  const opponentTeam = await db.opponentTeam.upsert({
    where: { organisationId_normalizedName: { organisationId: eventMatch.event.organisationId, normalizedName } },
    create: { displayName, normalizedName, organisationId: eventMatch.event.organisationId },
    update: { displayName },
  });

  await db.eventMatch.update({
    where: { id: eventMatchId },
    data: { opponentTeamId: opponentTeam.id },
  });

  return opponentTeam.id;
}