import { describe, it, expect } from "vitest";
import {
  extractNamedExportTexts,
  importedNamesFrom,
  computeSharedComponentOwnerPaths,
  scopedSharedContent,
} from "../scoped-export-content.mjs";
import { computeFingerprint } from "../fingerprint.mjs";

describe("extractNamedExportTexts", () => {
  it("extracts each top-level named export's own exact source text", () => {
    const source = [
      "export const A = 1;",
      "export function b() { return 2; }",
      "export type C = string;",
    ].join("\n");
    const result = extractNamedExportTexts(source, "shared.ts");
    expect(result?.get("A")).toBe("export const A = 1;");
    expect(result?.get("b")).toBe("\nexport function b() { return 2; }");
    expect(result?.get("C")).toBe("\nexport type C = string;");
  });

  it("includes a leading doc comment as part of the export's own text", () => {
    const source = "// a note about A\nexport const A = 1;\nexport const B = 2;";
    const result = extractNamedExportTexts(source, "shared.ts");
    expect(result?.get("A")).toContain("a note about A");
    expect(result?.get("B")).not.toContain("a note about A");
  });

  it("supports multiple bindings in one export statement", () => {
    const source = "export const A = 1, B = 2;";
    const result = extractNamedExportTexts(source, "shared.ts");
    expect(result?.get("A")).toBe(result?.get("B"));
    expect(result?.get("A")).toContain("A = 1, B = 2");
  });

  it("ignores non-exported declarations", () => {
    const source = "const internal = 1;\nexport const A = internal;";
    const result = extractNamedExportTexts(source, "shared.ts");
    expect(result?.has("internal")).toBe(false);
    expect(result?.has("A")).toBe(true);
  });

  it("parses .tsx source without throwing", () => {
    const source = "export const Widget = () => <div />;";
    expect(() => extractNamedExportTexts(source, "shared.tsx")).not.toThrow();
  });
});

describe("importedNamesFrom", () => {
  it("returns the named bindings imported from a matching relative module", () => {
    const source = 'import { b01Squad, B01_MATCH_ID } from "../shared/match-b-fixture";';
    const names = importedNamesFrom(source, "fixtures.ts", "match-b-fixture");
    expect(names).toEqual(new Set(["b01Squad", "B01_MATCH_ID"]));
  });

  it("resolves a renamed import to its original exported name", () => {
    const source = 'import { b01Squad as squad } from "../shared/match-b-fixture";';
    const names = importedNamesFrom(source, "fixtures.ts", "match-b-fixture");
    expect(names).toEqual(new Set(["b01Squad"]));
  });

  it("returns an empty set when the file never imports from that module", () => {
    const source = 'import { something } from "./unrelated";';
    const names = importedNamesFrom(source, "fixtures.ts", "match-b-fixture");
    expect(names).toEqual(new Set());
  });

  it("ignores an import from a different module with a similar name", () => {
    const source = 'import { x } from "../shared/match-b-fixture-v2";';
    const names = importedNamesFrom(source, "fixtures.ts", "match-b-fixture");
    expect(names).toEqual(new Set());
  });

  it("returns null for a namespace import — cannot safely bound it", () => {
    const source = 'import * as matchB from "../shared/match-b-fixture";';
    expect(importedNamesFrom(source, "fixtures.ts", "match-b-fixture")).toBeNull();
  });

  it("returns null for a default import of the shared module", () => {
    const source = 'import matchB from "../shared/match-b-fixture";';
    expect(importedNamesFrom(source, "fixtures.ts", "match-b-fixture")).toBeNull();
  });

  it("returns null for a re-export of the shared module", () => {
    const source = 'export { b01Squad } from "../shared/match-b-fixture";';
    expect(importedNamesFrom(source, "fixtures.ts", "match-b-fixture")).toBeNull();
  });

  it("returns an empty set for a bare side-effect import", () => {
    const source = 'import "../shared/match-b-fixture";';
    const names = importedNamesFrom(source, "fixtures.ts", "match-b-fixture");
    expect(names).toEqual(new Set());
  });
});

describe("computeSharedComponentOwnerPaths", () => {
  it("includes only paths listed by more than one scenario", () => {
    const scenarios = [
      { componentOwners: ["b01/fixtures.ts", "shared/match-b-fixture.ts"] },
      { componentOwners: ["b02/fixtures.ts", "shared/match-b-fixture.ts"] },
    ];
    expect(computeSharedComponentOwnerPaths(scenarios)).toEqual(new Set(["shared/match-b-fixture.ts"]));
  });

  it("excludes each scenario's own exclusively-owned file even when a shared path is also present", () => {
    const scenarios = [
      { componentOwners: ["b01/fixtures.ts", "shared/match-b-fixture.ts"] },
      { componentOwners: ["b02/fixtures.ts", "shared/match-b-fixture.ts"] },
    ];
    const shared = computeSharedComponentOwnerPaths(scenarios);
    expect(shared.has("b01/fixtures.ts")).toBe(false);
    expect(shared.has("b02/fixtures.ts")).toBe(false);
  });
});

describe("issue #827 regression — a shared fixture file's unrelated later addition must not invalidate an earlier scenario's fingerprint", () => {
  // Mirrors the real bug: B01 only ever imports its own export from the shared file; a later,
  // unrelated wave (B05) appends its own export to the end of the same shared file.
  const b01Fixtures = 'import { b01Squad } from "../shared/match-b-fixture";\nexport const x = b01Squad;';
  const b01Page = "export default function Page() { return null; }";
  const sharedBefore = "export const b01Squad = [1, 2, 3];\n";
  const sharedAfterB05Added = sharedBefore + "export const b05Squad = [4, 5, 6];\n";

  const b05Fixtures = 'import { b05Squad } from "../shared/match-b-fixture";\nexport const y = b05Squad;';

  function scenarios() {
    return [
      {
        scenarioId: "B01",
        componentOwners: ["b01/fixtures.ts", "b01/page.tsx", "shared/match-b-fixture.ts"],
      },
      {
        scenarioId: "B05",
        componentOwners: ["b05/fixtures.ts", "shared/match-b-fixture.ts"],
      },
    ];
  }

  function fingerprintFor(scenario, files, sharedPaths) {
    const rawContentByPath = new Map(scenario.componentOwners.map((p) => [p, files[p] ?? null]));
    const reader = new Map();
    for (const path of scenario.componentOwners) {
      const content = rawContentByPath.get(path);
      if (content === null || !sharedPaths.has(path)) {
        reader.set(path, content);
        continue;
      }
      reader.set(path, scopedSharedContent(path, content, scenario, rawContentByPath) ?? content);
    }
    return computeFingerprint(scenario.componentOwners, (p) => reader.get(p) ?? null);
  }

  it("B01's fingerprint is unchanged when B05 appends its own unrelated export to the shared file", () => {
    const sharedPaths = computeSharedComponentOwnerPaths(scenarios());
    const b01 = scenarios()[0];

    const before = fingerprintFor(
      b01,
      { "b01/fixtures.ts": b01Fixtures, "b01/page.tsx": b01Page, "shared/match-b-fixture.ts": sharedBefore },
      sharedPaths,
    );
    const after = fingerprintFor(
      b01,
      { "b01/fixtures.ts": b01Fixtures, "b01/page.tsx": b01Page, "shared/match-b-fixture.ts": sharedAfterB05Added },
      sharedPaths,
    );

    expect(after).toBe(before);
  });

  it("sanity check: the OLD whole-file hashing this replaces would have changed (proves the test isn't vacuous)", () => {
    const b01 = scenarios()[0];
    const wholeFileBefore = computeFingerprint(b01.componentOwners, (p) =>
      ({ "b01/fixtures.ts": b01Fixtures, "b01/page.tsx": b01Page, "shared/match-b-fixture.ts": sharedBefore }[p] ?? null),
    );
    const wholeFileAfter = computeFingerprint(b01.componentOwners, (p) =>
      ({ "b01/fixtures.ts": b01Fixtures, "b01/page.tsx": b01Page, "shared/match-b-fixture.ts": sharedAfterB05Added }[p] ?? null),
    );
    expect(wholeFileAfter).not.toBe(wholeFileBefore);
  });

  it("B01's fingerprint still changes when its OWN imported export's content actually changes", () => {
    const sharedPaths = computeSharedComponentOwnerPaths(scenarios());
    const b01 = scenarios()[0];
    const sharedWithChangedB01Export = "export const b01Squad = [1, 2, 3, 4];\n";

    const before = fingerprintFor(
      b01,
      { "b01/fixtures.ts": b01Fixtures, "b01/page.tsx": b01Page, "shared/match-b-fixture.ts": sharedBefore },
      sharedPaths,
    );
    const after = fingerprintFor(
      b01,
      { "b01/fixtures.ts": b01Fixtures, "b01/page.tsx": b01Page, "shared/match-b-fixture.ts": sharedWithChangedB01Export },
      sharedPaths,
    );

    expect(after).not.toBe(before);
  });

  it("B05's own fingerprint reflects its own export's content independently of B01", () => {
    const sharedPaths = computeSharedComponentOwnerPaths(scenarios());
    const b05 = scenarios()[1];

    const before = fingerprintFor(b05, { "b05/fixtures.ts": b05Fixtures, "shared/match-b-fixture.ts": sharedAfterB05Added }, sharedPaths);
    const sharedWithChangedB05Export = sharedBefore + "export const b05Squad = [9, 9, 9];\n";
    const after = fingerprintFor(b05, { "b05/fixtures.ts": b05Fixtures, "shared/match-b-fixture.ts": sharedWithChangedB05Export }, sharedPaths);

    expect(after).not.toBe(before);
  });
});
