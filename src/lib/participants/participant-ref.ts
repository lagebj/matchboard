// ADR-0106: centralized resolution of a Match participant identity, which may be a permanent
// tracked Player or a Group-owned GuestPlayer. Every place that currently resolves
// `participant.player?.name ?? participant.guestPlayer?.name` inline should resolve through this
// module instead (AGENTS.md/ADR-0106 §8: "do not scatter" participant name/identity resolution
// through UI and services).
//
// ParticipantType is a plain string union, not a closed two-member enum — a future
// "COLLABORATING_GROUP_PLAYER" source (discovery only, not implemented — see
// docs/domain/future-group-collaboration.md) is a type-union edit at that point, not a schema
// migration or a rewrite of every switch statement over this type.

export type ParticipantType = "PLAYER" | "GUEST_PLAYER";

export type ParticipantRef = {
  participantId: string;
  participantType: ParticipantType;
  playerId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  sourceLabel: string | null;
};

export type ParticipantPlayerLookup = Map<string, { firstName: string; lastName: string | null }>;
export type ParticipantGuestPlayerLookup = Map<string, { name: string; sourceLabel: string | null }>;

function formatPlayerName(player: { firstName: string; lastName: string | null }): string {
  return player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName;
}

/**
 * Resolves a `{ playerId, guestPlayerId }` pair (as stored on any dual-FK participant-bearing
 * model, e.g. `EventSquadPlayer`, `Goal`, `LeagueRoundParticipant`) into one `ParticipantRef`.
 * Exactly one of `playerId`/`guestPlayerId` must be non-null and resolvable in its lookup map —
 * callers that need to tolerate "neither set" (an empty lineup slot, an unattributed goal) must
 * check that case themselves before calling this, since a `ParticipantRef` always names someone.
 */
export function resolveParticipantRef(input: {
  playerId: string | null;
  guestPlayerId: string | null;
  playerLookup: ParticipantPlayerLookup;
  guestPlayerLookup: ParticipantGuestPlayerLookup;
}): ParticipantRef {
  assertExactlyOneParticipant(input.playerId, input.guestPlayerId);

  if (input.playerId) {
    const player = input.playerLookup.get(input.playerId);
    if (!player) {
      throw new Error(`resolveParticipantRef: playerId "${input.playerId}" not found in playerLookup.`);
    }
    return {
      participantId: input.playerId,
      participantType: "PLAYER",
      playerId: input.playerId,
      guestPlayerId: null,
      displayName: formatPlayerName(player),
      sourceLabel: null,
    };
  }

  const guestPlayerId = input.guestPlayerId!;
  const guestPlayer = input.guestPlayerLookup.get(guestPlayerId);
  if (!guestPlayer) {
    throw new Error(`resolveParticipantRef: guestPlayerId "${guestPlayerId}" not found in guestPlayerLookup.`);
  }
  return {
    participantId: guestPlayerId,
    participantType: "GUEST_PLAYER",
    playerId: null,
    guestPlayerId,
    displayName: guestPlayer.name,
    sourceLabel: guestPlayer.sourceLabel,
  };
}

/** Exactly one of playerId/guestPlayerId must be set — the fact must belong to someone. Mirrors
 * the hand-added Postgres CHECK constraint on the corresponding model (ADR-0106 §1.2). */
export function assertExactlyOneParticipant(playerId: string | null, guestPlayerId: string | null): void {
  const hasPlayer = playerId !== null && playerId !== undefined;
  const hasGuestPlayer = guestPlayerId !== null && guestPlayerId !== undefined;
  if (hasPlayer === hasGuestPlayer) {
    throw new Error(
      hasPlayer
        ? "assertExactlyOneParticipant: both playerId and guestPlayerId are set; exactly one is required."
        : "assertExactlyOneParticipant: neither playerId nor guestPlayerId is set; exactly one is required.",
    );
  }
}

/** At most one of playerId/guestPlayerId may be set — zero is legal (an empty lineup slot, an
 * unattributed goal). Mirrors the hand-added Postgres CHECK constraint on the corresponding
 * model (ADR-0106 §1.2). */
export function assertAtMostOneParticipant(playerId: string | null, guestPlayerId: string | null): void {
  const hasPlayer = playerId !== null && playerId !== undefined;
  const hasGuestPlayer = guestPlayerId !== null && guestPlayerId !== undefined;
  if (hasPlayer && hasGuestPlayer) {
    throw new Error("assertAtMostOneParticipant: both playerId and guestPlayerId are set; at most one is allowed.");
  }
}

/** "Oliver Hansen · Guest player · G2016" for a guest, "Daniel Berg" for a permanent Player
 * (no participant-type/source suffix — a Player's identity needs no qualifier). */
export function formatParticipantDisplayName(ref: ParticipantRef): string {
  if (ref.participantType === "PLAYER") return ref.displayName;
  return ref.sourceLabel
    ? `${ref.displayName} · Guest player · ${ref.sourceLabel}`
    : `${ref.displayName} · Guest player`;
}
