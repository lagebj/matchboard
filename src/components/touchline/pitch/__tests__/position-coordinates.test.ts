import { describe, it, expect } from "vitest";
import { positionCodeToPoint } from "../position-coordinates";

/**
 * Matchboard Players Operating Surface bundle, `03_POSITION_MODEL_AND_LABEL_CONTRACT.md §5`:
 * broad historical positions (DEFENDER/MIDFIELDER/FORWARD) can be placed on the canonical
 * position map, using a central zone since a broad declaration carries no left/right precision.
 */
describe("positionCodeToPoint broad historical zones", () => {
  it("places DEFENDER on the map", () => {
    expect(positionCodeToPoint("DEFENDER")).not.toBeNull();
  });

  it("places MIDFIELDER on the map", () => {
    expect(positionCodeToPoint("MIDFIELDER")).not.toBeNull();
  });

  it("places FORWARD on the map", () => {
    expect(positionCodeToPoint("FORWARD")).not.toBeNull();
  });

  it("returns null for a genuinely unknown code", () => {
    expect(positionCodeToPoint("SWEEPER")).toBeNull();
  });
});
