#!/usr/bin/env node

/**
 * Terminology check for Matchboard.
 *
 * Scans user-facing and canonical-documentation areas for clearly banned
 * vocabulary while supporting explicit exclusions for legacy identifiers
 * and historical ADR text.
 *
 * Usage:
 *   node scripts/check-terminology.mjs [--fix]
 *
 * Exit codes:
 *   0 — no violations found
 *   1 — violations found (or fix mode applied changes)
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, relative, extname } from "path";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const BANNED_TERMS = [
  { term: "Soccer", canonical: "Football", pattern: /\bSoccer\b/g, scope: "all" },
  { term: "soccer", canonical: "football", pattern: /\bsoccer\b/g, scope: "user-facing" },
  { term: "Starting lineup", canonical: "Starting line-up", pattern: /Starting lineup/g, scope: "all" },
  { term: "starting lineup", canonical: "starting line-up", pattern: /starting lineup/g, scope: "all" },
  { term: "Starting XI", canonical: "Starting line-up", pattern: /Starting XI/g, scope: "user-facing" },
  { term: "Benched", canonical: "Not selected this round", pattern: /\bbenched\b/gi, scope: "user-facing" },
  { term: "Backfill", canonical: "Squad repair (in visible text)", pattern: /\bBackfill\b/g, scope: "user-facing" },
  { term: "Jersey number", canonical: "Shirt number", pattern: /\bJersey number\b/g, scope: "user-facing" },
  { term: "jersey number", canonical: "shirt number", pattern: /\bjersey number\b/g, scope: "user-facing" },
  { term: "Planning period", canonical: "League season / Match round", pattern: /\bPlanning period\b/g, scope: "user-facing" },
  { term: "Phase (as league season)", canonical: "League season", pattern: /\bPhase\b/g, scope: "user-facing-docs" },
  { term: "Finalized (in visible UK English)", canonical: "Finalised", pattern: /\bFinalized\b/g, scope: "user-facing" },
  { term: "Finalization (in visible UK English)", canonical: "Finalisation", pattern: /\bFinalization\b/g, scope: "user-facing" },
  { term: "Fall (as season)", canonical: "Autumn", pattern: /\bFall\b/g, scope: "user-facing-docs" },
  { term: "Opponent rating", canonical: "Sporting level", pattern: /\bopponent rating\b/gi, scope: "all" },
  { term: "Opponent strength", canonical: "Sporting level", pattern: /\bopponent strength\b/gi, scope: "all" },
  { term: "Opponent quality score", canonical: "Sporting level", pattern: /\bopponent quality score\b/gi, scope: "all" },
  { term: "Weak opponent", canonical: "Lower-level opponent", pattern: /\bweak opponent\b/gi, scope: "all" },
  { term: "Strong opponent (as player judgement)", canonical: "Higher-level opponent", pattern: /\bstrong opponent\b/gi, scope: "user-facing" },
  { term: "Bad team", canonical: "", pattern: /\bbad team\b/gi, scope: "all" },
  { term: "Dirty players", canonical: "", pattern: /\bdirty players\b/gi, scope: "all" },
  { term: "Threat assessment", canonical: "Match environment", pattern: /\bthreat assessment\b/gi, scope: "all" },
  { term: "Roster (for squad)", canonical: "Squad", pattern: /\bRoster\b/g, scope: "user-facing-docs" },
  { term: "Lesser-player opportunity", canonical: "Development opportunity", pattern: /\bless-player?\s+opportunity\b/gi, scope: "all" },
  { term: "Better player (as permanent label)", canonical: "Established player", pattern: /\bbetter player\b/gi, scope: "user-facing" },
];

const EXCLUSION_PATTERNS = [
  /\/\.git\//,
  /\/node_modules\//,
  /\/\.next\//,
  /\/dist\//,
  /\.wasm$/,
  /\.map$/,
  /package-lock\.json/,
  /yarn\.lock/,
  /\.png$/,
  /\.jpg$/,
  /\.ico$/,
  /\.webp$/,
  /\/docs\/adr\//,
  /\/policies\/rego\//,
  /\/policies\/compiled\//,
  /\/policies\/packs\//,
  /\/policies\/examples\//,
  /\/prisma\/migrations\//,
  /\/scripts\/check-terminology\.mjs/,
  /\/docs\/domain\/terminology\.md/,
  /\/AGENTS\.md$/,
  /\/features\//,
  /\.test\./,
  /__tests__/,
];

const USER_FACING_DIRS = [
  "src/app",
  "src/components",
  "src/lib/formatters",
];

const DOC_DIRS = [
  "docs",
  "README.md",
  "features",
];

const ALL_DIRS = [
  ...USER_FACING_DIRS,
  ...DOC_DIRS,
  "src/lib",
  "src/app/api",
];

function shouldExclude(filePath) {
  return EXCLUSION_PATTERNS.some((p) => p.test(filePath));
}

function isScope(termScope, filePath) {
  if (termScope === "all") return true;
  if (termScope === "user-facing") return USER_FACING_DIRS.some((d) => filePath.startsWith(d));
  if (termScope === "user-facing-docs") return [...USER_FACING_DIRS, ...DOC_DIRS].some((d) => filePath.startsWith(d));
  return true;
}

function* walkDir(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDir(fullPath);
      } else if (entry.isFile()) {
        yield fullPath;
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

function checkFile(filePath) {
  const relPath = relative(REPO_ROOT, filePath);
  if (shouldExclude(relPath)) return [];

  const ext = extname(filePath);
  if (![".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".mjs", ".cjs"].includes(ext)) return [];

  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const violations = [];

  for (const { term, canonical, pattern, scope } of BANNED_TERMS) {
    if (!isScope(scope, relPath)) continue;

    const matches = content.matchAll(pattern);
    for (const match of matches) {
      violations.push({
        file: relPath,
        line: content.substring(0, match.index).split("\n").length,
        term,
        canonical,
        matched: match[0],
      });
    }
  }

  return violations;
}

function main() {
  const fixMode = process.argv.includes("--fix");

  const files = [
    ...walkDir(join(REPO_ROOT, "src")),
    ...walkDir(join(REPO_ROOT, "docs")),
  ];

  // Add root-level docs
  for (const rootFile of ["README.md", "AGENTS.md"]) {
    const fullPath = join(REPO_ROOT, rootFile);
    try {
      if (statSync(fullPath).isFile()) files.push(fullPath);
    } catch {
      // Skip missing files
    }
  }

  const allViolations = [];
  for (const file of files) {
    allViolations.push(...checkFile(file));
  }

  if (allViolations.length === 0) {
    console.log("✓ No terminology violations found.");
    process.exit(0);
  }

  console.log(`✗ Found ${allViolations.length} terminology violation(s):\n`);

  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line} — "${v.matched}" → use "${v.canonical}"`);
  }

  console.log(`\nTotal: ${allViolations.length} violation(s).`);

  if (fixMode) {
    console.log("\nNote: --fix mode is not yet implemented for terminology checks.");
    console.log("Please fix violations manually.");
  }

  process.exit(1);
}

main();