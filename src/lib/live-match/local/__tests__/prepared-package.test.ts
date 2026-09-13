import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { savePreparedPackage, getPreparedPackage, clearPreparedPackage, type PreparedLiveMatchPackageBase } from "../live-local-store";

/**
 * ADR-0138 Bundle 7 — prepared live match package storage. Each test uses its own unique
 * subjectId, matching this file's sibling `live-local-store.test.ts`'s established pattern for
 * why (the module never closes its `IDBDatabase` connections; repeatedly deleting the database
 * between tests was found to hang fake-indexeddb's queue).
 */

let counter = 0;
function uniqueSubjectId(): string {
  counter += 1;
  return `pkg-match-${counter}-${Date.now()}`;
}

interface TestPackage extends PreparedLiveMatchPackageBase {
  teamName: string;
}

describe("savePreparedPackage / getPreparedPackage / clearPreparedPackage", () => {
  it("round-trips a saved package", async () => {
    const subjectId = uniqueSubjectId();
    const pkg: TestPackage = { subjectType: "LEAGUE", subjectId, teamName: "A1 Blues", savedAt: Date.now() };
    await savePreparedPackage(pkg);
    const loaded = await getPreparedPackage<TestPackage>(subjectId);
    expect(loaded).toEqual(pkg);
  });

  it("returns null for a subject with no saved package", async () => {
    expect(await getPreparedPackage(uniqueSubjectId())).toBeNull();
  });

  it("overwrites a previous save for the same subject rather than duplicating", async () => {
    const subjectId = uniqueSubjectId();
    await savePreparedPackage<TestPackage>({ subjectType: "LEAGUE", subjectId, teamName: "First", savedAt: 1 });
    await savePreparedPackage<TestPackage>({ subjectType: "LEAGUE", subjectId, teamName: "Second", savedAt: 2 });
    const loaded = await getPreparedPackage<TestPackage>(subjectId);
    expect(loaded?.teamName).toBe("Second");
  });

  it("clearPreparedPackage removes the package", async () => {
    const subjectId = uniqueSubjectId();
    await savePreparedPackage<TestPackage>({ subjectType: "EVENT", subjectId, teamName: "Team", savedAt: Date.now() });
    await clearPreparedPackage(subjectId);
    expect(await getPreparedPackage(subjectId)).toBeNull();
  });

  it("keeps different subjects' packages independent", async () => {
    const a = uniqueSubjectId();
    const b = uniqueSubjectId();
    await savePreparedPackage<TestPackage>({ subjectType: "LEAGUE", subjectId: a, teamName: "A", savedAt: 1 });
    await savePreparedPackage<TestPackage>({ subjectType: "LEAGUE", subjectId: b, teamName: "B", savedAt: 2 });
    expect((await getPreparedPackage<TestPackage>(a))?.teamName).toBe("A");
    expect((await getPreparedPackage<TestPackage>(b))?.teamName).toBe("B");
  });
});
