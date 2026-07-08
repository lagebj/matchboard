import { describe, it, expect } from "vitest";
import { formatGameFormat } from "../game-format";

describe("formatGameFormat", () => {
  it("formats THREE_A_SIDE as 3-a-side", () => {
    expect(formatGameFormat("THREE_A_SIDE")).toBe("3-a-side");
  });

  it("formats FIVE_A_SIDE as 5-a-side", () => {
    expect(formatGameFormat("FIVE_A_SIDE")).toBe("5-a-side");
  });

  it("formats SEVEN_A_SIDE as 7-a-side", () => {
    expect(formatGameFormat("SEVEN_A_SIDE")).toBe("7-a-side");
  });

  it("formats NINE_A_SIDE as 9-a-side", () => {
    expect(formatGameFormat("NINE_A_SIDE")).toBe("9-a-side");
  });

  it("formats ELEVEN_A_SIDE as 11-a-side", () => {
    expect(formatGameFormat("ELEVEN_A_SIDE")).toBe("11-a-side");
  });

  it("handles unknown formats by replacing underscores", () => {
    expect(formatGameFormat("SOME_OTHER_FORMAT")).toBe("some-other-format");
  });
});