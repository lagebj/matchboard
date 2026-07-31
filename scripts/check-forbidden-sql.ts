#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const SRC_DIR = join(process.cwd(), "src");

const FORBIDDEN_PATTERNS = [
  { pattern: /\$queryRawUnsafe\b/g, name: "$queryRawUnsafe" },
  { pattern: /\$executeRawUnsafe\b/g, name: "$executeRawUnsafe" },
];

const IGNORED_DIRS = ["generated", "node_modules", ".next"];
const IGNORED_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
const IGNORED_FILES = [
  join("src", "lib", "tenancy", "tenant-client.ts"),
];

let violations = 0;

function walk(dir: string): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.includes(entry.name)) continue;
      walk(join(dir, entry.name));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !IGNORED_SUFFIXES.some((s) => entry.name.endsWith(s))
    ) {
      const filePath = join(dir, entry.name);
      const relPath = relative(process.cwd(), filePath);
      if (IGNORED_FILES.some((f) => relPath.endsWith(f))) continue;
      const content = readFileSync(filePath, "utf8");
      for (const { pattern, name } of FORBIDDEN_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          console.error(
            `FORBIDDEN: ${name} found in ${relative(process.cwd(), filePath)} (${matches.length} occurrence(s))`,
          );
          violations += matches.length;
        }
      }
    }
  }
}

walk(SRC_DIR);

if (violations > 0) {
  console.error(
    `\n${violations} violation(s) found. $queryRawUnsafe and $executeRawUnsafe are forbidden in application code.`,
  );
  console.error(
    "Use $queryRaw or $executeRaw with tagged template literals for safe parameterized queries.",
  );
  process.exit(1);
} else {
  console.log("No forbidden SQL methods found. Application code is clean.");
  process.exit(0);
}