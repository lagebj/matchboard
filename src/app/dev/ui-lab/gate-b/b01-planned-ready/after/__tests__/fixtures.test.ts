import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchIdentity as afterMatchIdentity } from "../fixtures";
import { matchIdentity as beforeMatchIdentity } from "../../fixtures";

describe("B01 AFTER fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});

describe("B01 before/after identity continuity", () => {
  it("is the same match id", () => {
    expect(afterMatchIdentity.id).toBe(beforeMatchIdentity.id);
  });

  it("has stable identity labels", () => {
    expect(afterMatchIdentity.homeTeam).toBe(beforeMatchIdentity.homeTeam);
    expect(afterMatchIdentity.awayTeam).toBe(beforeMatchIdentity.awayTeam);
  });

  it("has stable kickoff", () => {
    expect(afterMatchIdentity.kickoffDate).toBe(beforeMatchIdentity.kickoffDate);
    expect(afterMatchIdentity.kickoffTime).toBe(beforeMatchIdentity.kickoffTime);
  });

  it("has stable home/away orientation", () => {
    expect(afterMatchIdentity.ownTeamSide).toBe(beforeMatchIdentity.ownTeamSide);
  });

  it("shows no fabricated result before the match, and a real one after", () => {
    expect(beforeMatchIdentity.score).toBeNull();
    expect(afterMatchIdentity.score).not.toBeNull();
  });
});
