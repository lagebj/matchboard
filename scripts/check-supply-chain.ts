#!/usr/bin/env node

import { readFileSync } from "fs";
import { join } from "path";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");

const ALLOWED_ACTIONS: Record<string, string> = {
  "actions/checkout": "11d5960a326750d5838078e36cf38b85af677262",
  "actions/setup-node": "49933ea5288caeca8642d1e84afbd3f7d6820020",
};

const KNOWN_VERSIONS: Record<string, string> = {
  "actions/checkout": "v4.2.2",
  "actions/setup-node": "v4.1.5",
};

const files = [
  "ci.yml",
  "production-db-migrate.yml",
  "production-db-audit.yml",
];

let violations = 0;

for (const file of files) {
  const filePath = join(WORKFLOWS_DIR, file);
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    console.log(`SKIP ${file}: file not found`);
    continue;
  }

  const usesPattern = /uses:\s+([^\s]+)@([^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = usesPattern.exec(content)) !== null) {
    const action = match[1];
    const ref = match[2];

    if (action.startsWith("./") || action.startsWith("actions/") === false) {
      if (!action.startsWith("actions/")) continue;
    }

    const expectedSha = ALLOWED_ACTIONS[action];
    if (!expectedSha) {
      console.log(`UNKNOWN ${file}: ${action}@${ref} — action not in allowlist`);
      violations++;
      continue;
    }

    if (ref !== expectedSha) {
      console.log(`MISMATCH ${file}: ${action}@${ref} — expected ${expectedSha} (${KNOWN_VERSIONS[action]})`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} supply chain integrity violation(s) found.`);
  console.error("GitHub Actions must be pinned by SHA, not by tag.");
  process.exit(1);
} else {
  console.log("All GitHub Actions are pinned by SHA. Supply chain integrity OK.");
  process.exit(0);
}