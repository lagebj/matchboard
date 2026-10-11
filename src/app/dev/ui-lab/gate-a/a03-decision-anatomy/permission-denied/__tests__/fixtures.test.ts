import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, deniedReasonText, minimalMatchTeamName, minimalMatchOpponentName } from "../fixtures";

describe("A03-S3 permission-denied fixture", () => {
  it("exposes only a denial reason and the minimal match identity, never squad or slot detail", () => {
    expect(deniedReasonText).toMatch(/do not have access/i);
    expect(minimalMatchTeamName).toBeTruthy();
    expect(minimalMatchOpponentName).toBeTruthy();
    expect(Object.keys(rawRecordsForHash)).not.toContain("pendingStarterPlayerId");
    expect(Object.keys(rawRecordsForHash)).not.toContain("unfilledSlot");
  });

  it("fixtureSha256 matches an independent recomputation from the raw records", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("scenario id is A03-S3", () => {
    expect(identity.scenarioId).toBe("A03-S3");
  });
});
