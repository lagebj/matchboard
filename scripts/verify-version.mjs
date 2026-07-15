#!/usr/bin/env node

import { execSync } from "node:child_process";

const ROOT = process.cwd();

console.log("Verifying package version matches conventional commit history...");

try {
  execSync("node scripts/version-sync.mjs --verify", {
    encoding: "utf-8",
    cwd: ROOT,
    stdio: "inherit",
  });
  console.log("Version verification passed.");
} catch {
  console.error("Version verification failed.");
  process.exit(1);
}