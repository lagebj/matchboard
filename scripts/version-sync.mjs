#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const CONFIG_PATH = resolve(ROOT, "version.config.json");
const VERSION_MODULE_PATH = resolve(ROOT, "src/lib/version/index.ts");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerify = args.includes("--verify");

const CONVENTIONAL_COMMIT_RE = /^([a-zA-Z]+)(?:\([^)]+\))?!?:\s*.+/;
const BREAKING_FOOTER_RE = /^BREAKING CHANGE:\s*.+/m;

const BUMP_PRIORITY = { none: 0, patch: 1, minor: 2, major: 3 };

const NON_BUMP_TYPES = new Set(["docs", "test", "chore", "ci", "build", "refactor"]);
const PATCH_TYPES = new Set(["fix", "perf"]);
const MINOR_TYPES = new Set(["feat"]);

function classifyCommitMessage(message) {
  const firstLine = message.split("\n")[0];
  const match = firstLine.match(CONVENTIONAL_COMMIT_RE);

  if (!match) {
    throw new Error(`Malformed conventional commit message: "${firstLine}". Expected format: type(scope)!: description`);
  }

  const typePrefix = match[1];
  const isBreakingBang = firstLine.includes("!");
  const hasBreakingFooter = BREAKING_FOOTER_RE.test(message);
  const isBreaking = isBreakingBang || hasBreakingFooter;

  const type = typePrefix.toLowerCase();

  if (isBreaking) {
    return { type, bump: "major" };
  }
  if (MINOR_TYPES.has(type)) {
    return { type, bump: "minor" };
  }
  if (PATCH_TYPES.has(type)) {
    return { type, bump: "patch" };
  }
  if (NON_BUMP_TYPES.has(type)) {
    return { type, bump: "none" };
  }
  throw new Error(`Unknown conventional commit type: "${type}" in: "${firstLine}"`);
}

function calculateBump(messages, majorLock) {
  let highestBump = "none";

  for (const msg of messages) {
    const { bump } = classifyCommitMessage(msg);
    if (BUMP_PRIORITY[bump] > BUMP_PRIORITY[highestBump]) {
      highestBump = bump;
    }
  }

  if (majorLock !== null && majorLock !== undefined) {
    if (highestBump === "major") {
      highestBump = "minor";
    }
  }

  return highestBump;
}

function parseVersion(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`Invalid version format: "${version}". Expected semver (e.g. 0.1.0).`);
  }
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) };
}

function formatVersion(major, minor, patch) {
  return `${major}.${minor}.${patch}`;
}

function applyBump(currentVersion, bumpType, majorLock) {
  let { major, minor, patch } = parseVersion(currentVersion);

  switch (bumpType) {
    case "major":
      if (majorLock !== null && majorLock !== undefined) {
        minor += 1;
        patch = 0;
      } else {
        major += 1;
        minor = 0;
        patch = 0;
      }
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    case "none":
      break;
  }

  if (majorLock !== null && majorLock !== undefined) {
    major = majorLock;
  }

  return formatVersion(major, minor, patch);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function getMergeBase() {
  try {
    return execSync("git merge-base HEAD main", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    try {
      return execSync("git merge-base HEAD origin/main", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    } catch {
      return null;
    }
  }
}

function getCommitMessagesSinceBase() {
  const base = getMergeBase();
  if (!base) {
    console.log("No merge base with main found. No commits to analyze.");
    return [];
  }

  try {
    const log = execSync(`git log ${base}..HEAD --pretty=format:"%B---COMMIT_SEPARATOR---"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return log
      .split("---COMMIT_SEPARATOR---")
      .map((m) => m.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function syncVersionModule(version) {
  const content = `export const APP_VERSION = "${version}";\n`;
  writeFileSync(VERSION_MODULE_PATH, content, "utf-8");
}

function syncPackageLock() {
  try {
    execSync("npm install --package-lock-only --ignore-scripts", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: ROOT,
    });
  } catch (e) {
    console.error("Warning: Failed to sync package-lock.json:", e.message);
  }
}

function main() {
  const pkg = readJson(PKG_PATH);
  const config = readJson(CONFIG_PATH);

  const currentVersion = pkg.version;
  const majorLock = config.majorLock;

  if (typeof majorLock !== "number" || !Number.isInteger(majorLock) || majorLock < 0) {
    console.error(`Invalid majorLock in version.config.json: "${majorLock}". Must be a non-negative integer.`);
    process.exit(1);
  }

  const messages = getCommitMessagesSinceBase();

  // Find the base version from main
  const base = getMergeBase();
  let baseVersion = "0.1.0";
  if (base) {
    try {
      const basePkgContent = execSync(`git show ${base}:package.json`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      const basePkg = JSON.parse(basePkgContent);
      baseVersion = basePkg.version || "0.1.0";
    } catch {
      baseVersion = "0.1.0";
    }
  }

  const bumpType = calculateBump(messages, majorLock);
  const expectedVersion = applyBump(baseVersion, bumpType, majorLock);

  if (isDryRun) {
    console.log(`[dry-run] Base version: ${baseVersion}`);
    console.log(`[dry-run] Current version: ${currentVersion}`);
    console.log(`[dry-run] Calculated bump: ${bumpType}`);
    console.log(`[dry-run] Expected version: ${expectedVersion}`);
    console.log(`[dry-run] Major lock: ${majorLock}`);
    console.log(`[dry-run] Commits analyzed: ${messages.length}`);
    return;
  }

  if (isVerify) {
    if (currentVersion === expectedVersion) {
      console.log(`Version ${currentVersion} is correct (expected: ${expectedVersion}, bump: ${bumpType}).`);
      return;
    }
    console.error(`Version mismatch: current=${currentVersion}, expected=${expectedVersion} (bump: ${bumpType}).`);
    console.error(`Run scripts/version-sync.mjs to update.`);
    process.exit(1);
  }

  if (currentVersion === expectedVersion) {
    console.log(`Version ${currentVersion} is already up to date. No changes.`);
    syncVersionModule(currentVersion);
    return;
  }

  pkg.version = expectedVersion;
  writeJson(PKG_PATH, pkg);
  syncVersionModule(expectedVersion);
  console.log(`Version updated: ${currentVersion} → ${expectedVersion} (bump: ${bumpType})`);

  syncPackageLock();
  console.log("package-lock.json synced.");
}

main();