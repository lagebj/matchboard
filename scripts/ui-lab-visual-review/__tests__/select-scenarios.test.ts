import { describe, it, expect } from "vitest";
import { parseCaptureArgs, resolveSelectedScenarios } from "../select-scenarios.mjs";

const REGISTRY = [{ slug: "a01" }, { slug: "a02" }, { slug: "b01" }, { slug: "b02" }];

describe("parseCaptureArgs", () => {
  it("defaults to capture-everything when no selection flag is given", () => {
    expect(parseCaptureArgs([])).toEqual({ mode: "all", requested: null });
  });

  it("accepts an explicit --all", () => {
    expect(parseCaptureArgs(["--all"])).toEqual({ mode: "all", requested: null });
  });

  it("parses a single scenario", () => {
    expect(parseCaptureArgs(["--scenarios=a01"])).toEqual({ mode: "targeted", requested: ["a01"] });
  });

  it("parses multiple scenarios, trimming whitespace", () => {
    expect(parseCaptureArgs(["--scenarios= a01 , b02 "])).toEqual({
      mode: "targeted",
      requested: ["a01", "b02"],
    });
  });

  it("rejects --all combined with --scenarios=", () => {
    expect(() => parseCaptureArgs(["--all", "--scenarios=a01"])).toThrow(/mutually exclusive/);
  });

  it("rejects an empty --scenarios= selection", () => {
    expect(() => parseCaptureArgs(["--scenarios="])).toThrow(/non-empty/);
  });

  it("rejects a --scenarios= selection with an empty entry", () => {
    expect(() => parseCaptureArgs(["--scenarios=a01,,b02"])).toThrow(/non-empty/);
  });

  it("rejects a duplicate scenario id", () => {
    expect(() => parseCaptureArgs(["--scenarios=a01,a01"])).toThrow(/Duplicate scenario selection: a01/);
  });
});

describe("resolveSelectedScenarios", () => {
  it("mode all returns every registered scenario, in registration order", () => {
    const result = resolveSelectedScenarios(REGISTRY, { mode: "all", requested: null });
    expect(result.selected).toEqual(REGISTRY);
    expect(result.requestedIds).toEqual(["a01", "a02", "b01", "b02"]);
  });

  it("mode targeted returns only the requested scenarios", () => {
    const result = resolveSelectedScenarios(REGISTRY, { mode: "targeted", requested: ["b02"] });
    expect(result.selected).toEqual([{ slug: "b02" }]);
  });

  it("preserves registration order regardless of requested-argument order", () => {
    const result = resolveSelectedScenarios(REGISTRY, { mode: "targeted", requested: ["b02", "a01"] });
    expect(result.selected.map((s) => s.slug)).toEqual(["a01", "b02"]);
  });

  it("rejects an unknown scenario id", () => {
    expect(() =>
      resolveSelectedScenarios(REGISTRY, { mode: "targeted", requested: ["does-not-exist"] }),
    ).toThrow(/Unknown scenario id\(s\): does-not-exist/);
  });

  it("rejects the whole selection if any id is unknown, even when others are valid", () => {
    expect(() =>
      resolveSelectedScenarios(REGISTRY, { mode: "targeted", requested: ["a01", "nope"] }),
    ).toThrow(/Unknown scenario id\(s\): nope/);
  });

  it("never produces an empty selection that could report success", () => {
    // A valid targeted request always has at least one requested id (parseCaptureArgs guarantees
    // this), and every requested id must be registered (guaranteed above) — so resolved selection
    // length is always >= 1 for a request that doesn't throw.
    const result = resolveSelectedScenarios(REGISTRY, { mode: "targeted", requested: ["a02"] });
    expect(result.selected.length).toBeGreaterThan(0);
  });
});
