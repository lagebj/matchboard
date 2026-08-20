#!/usr/bin/env node

/**
 * Architecture boundary check for Matchboard (Consolidation Programme §59).
 *
 * Enforces the target dependency direction (Next.js/UI -> application services -> domain
 * policies -> repository interfaces -> infrastructure, PROGRAMME.md §58) for the directories
 * documented as the pure domain/policy layer in AGENTS.md's "Selection architecture" and
 * "Policy-capable selection engine" sections: domain policy code must never import Next.js,
 * Brevo, or Vercel SDKs directly.
 *
 * Scope is deliberately narrow and explicit, not "all of src/lib" — src/lib also contains
 * legitimate application-service-ish glue (auth redirects, cache revalidation) that this check
 * does not claim ownership of. Widen SCANNED_DIRS only when a new directory is genuinely added
 * to the pure domain/policy layer.
 *
 * Usage:
 *   node scripts/check-architecture-boundaries.mjs
 *
 * Exit codes:
 *   0 — no violations found
 *   1 — violations found
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

// Directories that must stay free of Next.js/Brevo/Vercel imports.
const SCANNED_DIRS = [
  "src/lib/selection",
  "src/lib/policies",
  "src/lib/rules",
  "src/lib/groups",
  "src/domain/team-composition",
];

// Files inside SCANNED_DIRS that are deliberately the application-service/adapter layer, not
// domain policy code, and may import Next.js freely (documented in AGENTS.md as such).
const ALLOWED_EXCEPTIONS = new Set([
  "src/domain/team-composition/league-team-adapter.ts",
]);

const FORBIDDEN_IMPORTS = [
  { pattern: /^next$/, label: "next" },
  { pattern: /^next\//, label: "next/*" },
  { pattern: /@getbrevo\/brevo/, label: "@getbrevo/brevo" },
  { pattern: /^@vercel\//, label: "@vercel/*" },
];

const IMPORT_SPECIFIER_PATTERN = /(?:import|export)\s[^;]*?\sfrom\s+["']([^"']+)["']|(?:import|require)\(\s*["']([^"']+)["']\s*\)/g;

function isTestFile(filePath) {
  return /\.test\.tsx?$/.test(filePath) || /\/__tests__\//.test(filePath);
}

function walkDir(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, files);
    } else if (/\.tsx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkFile(filePath) {
  const relPath = relative(REPO_ROOT, filePath);
  if (isTestFile(relPath) || ALLOWED_EXCEPTIONS.has(relPath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf8");
  const violations = [];
  let match;
  IMPORT_SPECIFIER_PATTERN.lastIndex = 0;
  while ((match = IMPORT_SPECIFIER_PATTERN.exec(content)) !== null) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (forbidden.pattern.test(specifier)) {
        const line = content.slice(0, match.index).split("\n").length;
        violations.push({ file: relPath, line, specifier, label: forbidden.label });
      }
    }
  }
  return violations;
}

function main() {
  const files = SCANNED_DIRS.flatMap((dir) => walkDir(join(REPO_ROOT, dir)));

  const allViolations = [];
  for (const file of files) {
    allViolations.push(...checkFile(file));
  }

  if (allViolations.length === 0) {
    console.log(`✓ No architecture boundary violations found (${files.length} files scanned across ${SCANNED_DIRS.length} domain directories).`);
    process.exit(0);
  }

  console.log(`✗ Found ${allViolations.length} architecture boundary violation(s):\n`);
  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line} — imports "${v.specifier}" (forbidden: ${v.label})`);
  }
  console.log(
    `\nDomain/policy code in ${SCANNED_DIRS.join(", ")} must not import Next.js, Brevo, or ` +
      "Vercel SDKs directly (PROGRAMME.md §58). Move the Next.js-dependent call into the " +
      "calling application-service/action layer instead, or add a documented, narrow exception " +
      "to ALLOWED_EXCEPTIONS in this script if the file is genuinely part of the adapter layer.",
  );
  process.exit(1);
}

main();
