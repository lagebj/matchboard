#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const VERSION_MODULE_PATH = resolve(ROOT, "src/lib/version/index.ts");

const args = process.argv.slice(2);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
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

function parseVersion(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`Invalid version format: "${version}". Expected semver (e.g. 0.1.0).`);
  }
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) };
}

function validateSemVer(version) {
  parseVersion(version);
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

  return `${major}.${minor}.${patch}`;
}

function main() {
  const pkg = readJson(PKG_PATH);
  const currentVersion = pkg.version;

  validateSemVer(currentVersion);

  if (args.length === 0) {
    console.error("Usage: version-bump.mjs <patch|minor>");
    console.error("  patch  Increment PATCH version (0.x.y → 0.x.(y+1))");
    console.error("  minor  Increment MINOR version (0.x.y → 0.(x+1).0)");
    process.exit(1);
  }

  const bumpType = args[0];

  if (bumpType !== "patch" && bumpType !== "minor") {
    console.error(`Invalid bump type: "${bumpType}". Use "patch" or "minor".`);
    process.exit(1);
  }

  const config = readJson(resolve(ROOT, "version.config.json"));
  const majorLock = config.majorLock;
  const newVersion = applyBump(currentVersion, bumpType, majorLock);

  pkg.version = newVersion;
  writeJson(PKG_PATH, pkg);
  syncVersionModule(newVersion);
  syncPackageLock();

  console.log(`Version bumped: ${currentVersion} → ${newVersion} (${bumpType})`);
}

main();