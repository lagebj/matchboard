import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, participants } from "../fixtures";

describe("B06 Event · Before fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("includes exactly one genuine helper and one genuine guest player, as two distinct participants", () => {
    const helpers = participants.filter((p) => p.source === "helper");
    const guests = participants.filter((p) => p.participantType === "GUEST_PLAYER");
    expect(helpers).toHaveLength(1);
    expect(guests).toHaveLength(1);
    expect(helpers[0]?.participantId).not.toBe(guests[0]?.participantId);
  });

  it("the helper's sourceSquadName is a different squad than the planning squad itself", () => {
    const helper = participants.find((p) => p.source === "helper");
    const squadParticipant = participants.find((p) => p.source === "squad" && p.participantType === "PLAYER");
    expect(helper?.sourceSquadName).not.toBe(squadParticipant?.sourceSquadName);
  });

  it("never carries a forbidden fabricated metric (possession/xG/shots/cards/rating/Player of the Match)", () => {
    const serialized = JSON.stringify(rawRecordsForHash).toLowerCase();
    for (const forbidden of ["possession", "xg", "expectedgoals", "shots", "cards", "rating", "playerofthematch"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
