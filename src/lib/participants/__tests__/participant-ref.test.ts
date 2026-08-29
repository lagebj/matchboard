import { describe, it, expect } from "vitest";
import {
  resolveParticipantRef,
  assertExactlyOneParticipant,
  assertAtMostOneParticipant,
  formatParticipantDisplayName,
  type ParticipantPlayerLookup,
  type ParticipantGuestPlayerLookup,
} from "../participant-ref";

const playerLookup: ParticipantPlayerLookup = new Map([
  ["player-1", { firstName: "Daniel", lastName: "Berg" }],
  ["player-2", { firstName: "Madonna", lastName: null }],
]);

const guestPlayerLookup: ParticipantGuestPlayerLookup = new Map([
  ["guest-1", { name: "Oliver Hansen", sourceLabel: "G2016" }],
  ["guest-2", { name: "Emil Larsen", sourceLabel: null }],
]);

describe("resolveParticipantRef", () => {
  it("resolves a Player participant", () => {
    const ref = resolveParticipantRef({
      playerId: "player-1",
      guestPlayerId: null,
      playerLookup,
      guestPlayerLookup,
    });

    expect(ref).toEqual({
      participantId: "player-1",
      participantType: "PLAYER",
      playerId: "player-1",
      guestPlayerId: null,
      displayName: "Daniel Berg",
      sourceLabel: null,
    });
  });

  it("resolves a Player with no last name", () => {
    const ref = resolveParticipantRef({
      playerId: "player-2",
      guestPlayerId: null,
      playerLookup,
      guestPlayerLookup,
    });

    expect(ref.displayName).toBe("Madonna");
  });

  it("resolves a GuestPlayer participant with a source label", () => {
    const ref = resolveParticipantRef({
      playerId: null,
      guestPlayerId: "guest-1",
      playerLookup,
      guestPlayerLookup,
    });

    expect(ref).toEqual({
      participantId: "guest-1",
      participantType: "GUEST_PLAYER",
      playerId: null,
      guestPlayerId: "guest-1",
      displayName: "Oliver Hansen",
      sourceLabel: "G2016",
    });
  });

  it("resolves a GuestPlayer participant with no source label", () => {
    const ref = resolveParticipantRef({
      playerId: null,
      guestPlayerId: "guest-2",
      playerLookup,
      guestPlayerLookup,
    });

    expect(ref.sourceLabel).toBeNull();
  });

  it("throws when both playerId and guestPlayerId are set", () => {
    expect(() =>
      resolveParticipantRef({
        playerId: "player-1",
        guestPlayerId: "guest-1",
        playerLookup,
        guestPlayerLookup,
      }),
    ).toThrow(/exactly one is required/);
  });

  it("throws when neither playerId nor guestPlayerId are set", () => {
    expect(() =>
      resolveParticipantRef({
        playerId: null,
        guestPlayerId: null,
        playerLookup,
        guestPlayerLookup,
      }),
    ).toThrow(/exactly one is required/);
  });

  it("throws when the playerId is not found in the lookup", () => {
    expect(() =>
      resolveParticipantRef({
        playerId: "unknown-player",
        guestPlayerId: null,
        playerLookup,
        guestPlayerLookup,
      }),
    ).toThrow(/not found in playerLookup/);
  });

  it("throws when the guestPlayerId is not found in the lookup", () => {
    expect(() =>
      resolveParticipantRef({
        playerId: null,
        guestPlayerId: "unknown-guest",
        playerLookup,
        guestPlayerLookup,
      }),
    ).toThrow(/not found in guestPlayerLookup/);
  });
});

describe("assertExactlyOneParticipant", () => {
  it("does not throw when exactly one is set", () => {
    expect(() => assertExactlyOneParticipant("player-1", null)).not.toThrow();
    expect(() => assertExactlyOneParticipant(null, "guest-1")).not.toThrow();
  });

  it("throws when both are set", () => {
    expect(() => assertExactlyOneParticipant("player-1", "guest-1")).toThrow(/exactly one is required/);
  });

  it("throws when neither is set", () => {
    expect(() => assertExactlyOneParticipant(null, null)).toThrow(/exactly one is required/);
  });
});

describe("assertAtMostOneParticipant", () => {
  it("does not throw when exactly one is set", () => {
    expect(() => assertAtMostOneParticipant("player-1", null)).not.toThrow();
    expect(() => assertAtMostOneParticipant(null, "guest-1")).not.toThrow();
  });

  it("does not throw when neither is set", () => {
    expect(() => assertAtMostOneParticipant(null, null)).not.toThrow();
  });

  it("throws when both are set", () => {
    expect(() => assertAtMostOneParticipant("player-1", "guest-1")).toThrow(/at most one is allowed/);
  });
});

describe("formatParticipantDisplayName", () => {
  it("returns the plain name for a Player, with no suffix", () => {
    const ref = resolveParticipantRef({
      playerId: "player-1",
      guestPlayerId: null,
      playerLookup,
      guestPlayerLookup,
    });

    expect(formatParticipantDisplayName(ref)).toBe("Daniel Berg");
  });

  it("appends the guest/source suffix for a GuestPlayer with a source label", () => {
    const ref = resolveParticipantRef({
      playerId: null,
      guestPlayerId: "guest-1",
      playerLookup,
      guestPlayerLookup,
    });

    expect(formatParticipantDisplayName(ref)).toBe("Oliver Hansen · Guest player · G2016");
  });

  it("omits the source label when a GuestPlayer has none", () => {
    const ref = resolveParticipantRef({
      playerId: null,
      guestPlayerId: "guest-2",
      playerLookup,
      guestPlayerLookup,
    });

    expect(formatParticipantDisplayName(ref)).toBe("Emil Larsen · Guest player");
  });
});
