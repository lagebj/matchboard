import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "check-prisma-query-fields.mjs");

const tmpDirs: string[] = [];
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "prisma-field-check-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}
afterAll(() => tmpDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function run(dir: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, dir], { cwd: REPO_ROOT, encoding: "utf8" });
    return { code: 0, out };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("check-prisma-query-fields", () => {
  it("flags an invalid nested `select` field in a multi-key query (the ARR-0039 class)", () => {
    const dir = fixture({
      "bad.ts": `
        import { db } from "@/lib/db";
        export const q = (id: string) =>
          db.match.findFirst({ where: { id }, select: { id: true, type: true } });
      `,
    });
    const { code, out } = run(dir);
    expect(code).toBe(1);
    expect(out).toMatch(/bad\.ts:\d+\s+'type' is not a field of Prisma\.MatchSelect/);
  });

  it("flags an invalid `where` field", () => {
    const dir = fixture({
      "bad-where.ts": `
        import { db } from "@/lib/db";
        export const q = () =>
          db.match.findMany({ where: { bogusColumn: 1, status: "SCHEDULED" }, select: { id: true } });
      `,
    });
    const { code, out } = run(dir);
    expect(code).toBe(1);
    expect(out).toMatch(/'bogusColumn' is not a field of Prisma\.MatchWhereInput/);
  });

  it("passes a correct multi-key query and compound unique where keys", () => {
    const dir = fixture({
      "good.ts": `
        import { db } from "@/lib/db";
        export const a = (id: string) =>
          db.match.findFirst({ where: { id }, select: { id: true, matchType: true, startsAt: true } });
        export const b = (playerId: string, matchRoundId: string) =>
          db.availability.findUnique({ where: { playerId_matchRoundId: { playerId, matchRoundId } } });
      `,
    });
    const { code, out } = run(dir);
    expect(code).toBe(0);
    expect(out).toMatch(/no invalid fields/);
  });
});
