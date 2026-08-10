#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const VERSION_MODULE_PATH = resolve(ROOT, "src/lib/version/index.ts");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function readVersionModule() {
  const content = readFileSync(VERSION_MODULE_PATH, "utf-8");
  const match = content.match(/export\s+const\s+APP_VERSION\s*=\s*"([^"]+)"/);
  if (!match) {
    return null;
  }
  return match[1];
}

function parseVersion(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`Invalid version format: "${version}". Expected semver (e.g. 0.1.0).`);
  }
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) };
}

function main() {
  const pkg = readJson(PKG_PATH);
  const pkgVersion = pkg.version;
  const config = readJson(resolve(ROOT, "version.config.json"));
  const majorLock = config.majorLock;
  let errors = 0;

  console.log(`Verifying Matchboard version...`);
  console.log(`  package.json version: ${pkgVersion}`);

  // 1. Valid SemVer
  try {
    const parsed = parseVersion(pkgVersion);
    console.log(`  Parsed: ${parsed.major}.${parsed.minor}.${parsed.patch}`);

    // 2. Pre-1.0 guard: version must not reach 1.0.0 without explicit authorisation
    if (majorLock !== undefined && majorLock !== null && parsed.major !== majorLock) {
      console.error(`  ERROR: Version ${pkgVersion} has major=${parsed.major}, but majorLock=${majorLock}.`);
      console.error(`  Incrementing beyond 0.x.y requires explicit product owner authorisation.`);
      errors++;
    }

    // 3. Major lock enforcement
    if (majorLock === 0 && parsed.major >= 1) {
      console.error(`  ERROR: Version ${pkgVersion} is >= 1.0.0 while major is locked at 0.`);
      console.error(`  1.0.0 requires explicit product owner authorisation per docs/VERSIONING.md.`);
      errors++;
    }
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    errors++;
  }

  // 4. Consistency: src/lib/version/index.ts must match package.json
  const moduleVersion = readVersionModule();
  console.log(`  version module:      ${moduleVersion || "(not found)"}`);

  if (moduleVersion !== pkgVersion) {
    console.error(`  ERROR: src/lib/version/index.ts says "${moduleVersion}" but package.json says "${pkgVersion}".`);
    console.error(`  Run: npm run prebuild`);
    errors++;
  }

  if (errors > 0) {
    console.error(`\nVersion verification failed with ${errors} error(s).`);
    process.exit(1);
  }

  console.log(`\nVersion verification passed: ${pkgVersion}`);
}

main();