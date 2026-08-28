#!/usr/bin/env node

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");

// Every GitHub Action pin actually used across .github/workflows/**. Updating an action's
// version here is a deliberate security-review step (AGENTS.md: "New dependencies and GitHub
// Actions require security review"), not something a dependency bot should silently redirect
// unreviewed -- see ARR-0023's 2026-08-28 history entry for why this table must stay accurate
// and cover every real workflow file, not a stale subset.
const ALLOWED_ACTIONS: Record<string, string> = {
  "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1", // v7.0.1
  "actions/setup-node": "820762786026740c76f36085b0efc47a31fe5020", // v7.0.0
  "actions/upload-artifact": "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a", // v7.0.1
  "actions/github-script": "3a2844b7e9c422d3c10d287c895573f7108da1b3", // v9.0.0
};

const SHA_PATTERN = /^[0-9a-f]{40}$/;

let violations = 0;

const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

if (files.length === 0) {
  console.error(`No workflow files found in ${WORKFLOWS_DIR}.`);
  process.exit(1);
}

for (const file of files) {
  const filePath = join(WORKFLOWS_DIR, file);
  const content = readFileSync(filePath, "utf8");

  const usesPattern = /uses:\s+([^\s]+)@([^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = usesPattern.exec(content)) !== null) {
    const action = match[1];
    const ref = match[2];

    // Local/composite actions (./path) and non-actions/* third-party actions are out of scope
    // for this table today -- extend ALLOWED_ACTIONS if a new third-party action is adopted.
    if (!action.startsWith("actions/")) continue;

    if (!SHA_PATTERN.test(ref)) {
      console.log(`UNPINNED ${file}: ${action}@${ref} — must be pinned to a full commit SHA, not a tag/branch`);
      violations++;
      continue;
    }

    const expectedSha = ALLOWED_ACTIONS[action];
    if (!expectedSha) {
      console.log(`UNKNOWN ${file}: ${action}@${ref} — action not in allowlist`);
      violations++;
      continue;
    }

    if (ref !== expectedSha) {
      console.log(`MISMATCH ${file}: ${action}@${ref} — expected ${expectedSha}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} supply chain integrity violation(s) found.`);
  console.error("GitHub Actions must be pinned by SHA, not by tag.");
  process.exit(1);
} else {
  console.log(`All GitHub Actions across ${files.length} workflow file(s) are pinned by SHA. Supply chain integrity OK.`);
  process.exit(0);
}
