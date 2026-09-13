import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ADR-0138 (Bundle 4) — "One canonical mutation path": after the single-mutation-path cutover,
 * the Durable Object coordinator (via the signed internal endpoint) is the only normal path a
 * browser-originated live operation is canonically ordered through. `recordLiveEventAction`
 * (the direct-HTTP fallback that used to exist beside it, ARR-0045) is removed entirely, not
 * merely unused.
 *
 * These are static/content assertions (matching this repo's existing pattern, e.g.
 * `src/test/security-audit.test.ts`) rather than a full architecture-boundary scanner, because
 * the property being proven is narrow and specific to this one write path, not a general
 * import-boundary rule.
 */

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

describe("Single canonical live-operation mutation path (ADR-0138, Bundle 4)", () => {
  it("recordLiveEventAction is no longer exported as a callable server action — the next test proves no code path imports/calls it", () => {
    // Confirms the actual export site is gone (as opposed to merely unused) — a lingering
    // unused export would be exactly the kind of dead fallback code Bundle 4's own work item 8
    // requires removing. Prose mentions elsewhere (explaining the architecture/history) are
    // legitimate and are not what this checks for.
    const content = read("src/app/(app)/matches/[matchId]/live/live-actions.ts");
    expect(content).not.toMatch(/export\s+async\s+function\s+recordLiveEventAction/);
  });

  it("the dead local-first-then-HTTP module (local/live-sync.ts) is removed, not just unreachable", () => {
    expect(fs.existsSync(path.join(ROOT, "src/lib/live-match/local/live-sync.ts"))).toBe(false);
  });

  it("league-live-match-client.tsx does not import a canonical-persistence server action directly — only the realtime client and read-only actions", () => {
    const content = read("src/components/live-match/league-live-match-client.tsx");
    // The only server actions this file may import are read/lifecycle actions (start/heartbeat/
    // clock/recent-events/pre-match-package) and the end-session/report-handoff action — never
    // a live-event canonical-persistence write. Both `recordLiveEventAction` and
    // `recordEventForActor` may still be *mentioned in prose comments* explaining the
    // architecture (e.g. this file's own doc comment on why it no longer falls back to HTTP),
    // so this checks for an actual import/call, not any occurrence of the name.
    expect(content).not.toMatch(/import\s*\{[^}]*recordLiveEventAction/);
    expect(content).not.toMatch(/\brecordLiveEventAction\(/);
    expect(content).not.toMatch(/import\s*\{[^}]*recordEventForActor/);
    expect(content).not.toMatch(/recordEventForActor\(/);
  });

  /** Matches an actual import of or call to `recordEventForActor` — never a bare mention of the
   * name inside a `/** ... *\/` or `//` prose comment, which is legitimate architecture
   * documentation, not a violation. */
  function importsOrCallsRecordEventForActor(content: string): boolean {
    return /import\s*\{[^}]*recordEventForActor/.test(content) || /recordEventForActor\(/.test(content);
  }

  it("no client component ('use client') imports or calls recordEventForActor — it is reachable only via the internal signed endpoint or a legitimate server-side caller", () => {
    const offendingFiles: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.startsWith('"use client"') && importsOrCallsRecordEventForActor(content)) {
            offendingFiles.push(path.relative(ROOT, fullPath));
          }
        }
      }
    }

    walk(path.join(ROOT, "src/components"));
    walk(path.join(ROOT, "src/app"));

    expect(offendingFiles).toEqual([]);
  });

  it("recordEventForActor's only import/call sites are the internal endpoint and its own owning module", () => {
    const offendingFiles: string[] = [];
    const allowedCallers = new Set([
      "src/lib/live-match/live-match-event-store.ts", // owning module (defines it)
      "src/app/api/internal/live-match/events/route.ts", // the one internal, coordinator-only endpoint
    ]);

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const relative = path.relative(ROOT, fullPath).replace(/\\/g, "/");
          if (importsOrCallsRecordEventForActor(content) && !allowedCallers.has(relative)) {
            offendingFiles.push(relative);
          }
        }
      }
    }

    walk(path.join(ROOT, "src"));

    expect(offendingFiles).toEqual([]);
  });
});
