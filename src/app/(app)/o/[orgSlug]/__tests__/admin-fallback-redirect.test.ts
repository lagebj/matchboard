import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ADR-0157 C8: `/more` is retired. The three admin-only "transient" tool pages
 * (evidence-rebuild, opponent-population, ai-backfill) used to fall back to `/more` when a
 * non-admin actor hit them directly; that destination is now dead. Guards against silently
 * reintroducing a dead redirect target if one of these pages is touched again later.
 */
const ADMIN_FALLBACK_PAGES = [
  "evidence-rebuild/page.tsx",
  "opponent-population/page.tsx",
  "ai-backfill/page.tsx",
];

describe("admin-only tool pages' non-admin fallback redirect", () => {
  for (const relativePath of ADMIN_FALLBACK_PAGES) {
    it(`${relativePath} does not redirect to the retired /more route`, () => {
      const source = readFileSync(join(__dirname, "..", relativePath), "utf-8");
      expect(source).not.toMatch(/redirect\(`\/o\/\$\{orgSlug\}\/more`\)/);
      expect(source).toMatch(/redirect\(`\/o\/\$\{orgSlug\}\/settings`\)/);
    });
  }
});
