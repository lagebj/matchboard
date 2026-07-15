#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";
import http from "node:http";

const REPO_ROOT = join(import.meta.dirname, "..");
const CONFIG_PATH = join(REPO_ROOT, "opa.config.json");
const CACHE_DIR = join(REPO_ROOT, ".opa-cache");

function detectPlatform() {
  const os = process.platform;
  const arch = process.arch;

  if (os === "darwin" && arch === "arm64") return "darwin-arm64";
  if (os === "darwin" && arch === "x64") return "darwin-x64";
  if (os === "linux" && arch === "arm64") return "linux-arm64";
  if (os === "linux" && arch === "x64") return "linux-x64";

  console.error(`Unsupported platform: ${os}/${arch}`);
  console.error("Supported platforms: darwin/arm64, darwin/x64, linux/arm64, linux/x64");
  process.exit(1);
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`OPA config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

  if (!config.version) {
    console.error("opa.config.json missing 'version' field");
    process.exit(1);
  }

  if (!config.checksums || typeof config.checksums !== "object") {
    console.error("opa.config.json missing 'checksums' field");
    process.exit(1);
  }

  if (!config.platforms || typeof config.platforms !== "object") {
    console.error("opa.config.json missing 'platforms' field");
    process.exit(1);
  }

  return config;
}

function downloadBuffer(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl, redirectsLeft) => {
      const parsed = new URL(currentUrl);
      const mod = parsed.protocol === "https:" ? https : http;

      mod.get(parsed, { headers: { "User-Agent": "matchboard-bootstrap-opa" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects downloading ${url}`));
            return;
          }
          const nextUrl = new URL(res.headers.location, currentUrl).href;
          res.resume();
          attempt(nextUrl, redirectsLeft - 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} downloading ${currentUrl}`));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    };
    attempt(url, maxRedirects);
  });
}

function computeSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function bootstrap() {
  const config = loadConfig();
  const version = config.version;
  const platformKey = detectPlatform();
  const binaryName = config.platforms[platformKey];

  if (!binaryName) {
    console.error(`No binary name mapping for platform ${platformKey}`);
    console.error(`Available platform mappings: ${Object.keys(config.platforms).join(", ")}`);
    process.exit(1);
  }

  const expectedChecksum = config.checksums[binaryName];

  if (!expectedChecksum) {
    console.error(`No checksum configured for binary ${binaryName}`);
    process.exit(1);
  }

  const cachedBinary = join(CACHE_DIR, binaryName);

  mkdirSync(CACHE_DIR, { recursive: true });

  if (existsSync(cachedBinary)) {
    const existingData = readFileSync(cachedBinary);
    const existingHash = computeSha256(existingData);

    if (existingHash === expectedChecksum) {
      console.log(`OPA v${version} cached at ${cachedBinary} (checksum verified)`);
      if (process.argv.includes("--json")) {
        console.log(JSON.stringify({ opaPath: cachedBinary, version, platform: platformKey, binary: binaryName, cached: true }));
      }
      return;
    }

    console.log(`Cached binary checksum mismatch (expected ${expectedChecksum}, got ${existingHash}). Re-downloading...`);
  }

  const downloadUrl = `https://github.com/open-policy-agent/opa/releases/download/v${version}/${binaryName}`;
  console.log(`Downloading OPA v${version} for ${platformKey} (${binaryName})...`);
  console.log(`  URL: ${downloadUrl}`);

  let buffer;
  try {
    buffer = await downloadBuffer(downloadUrl);
  } catch (err) {
    console.error(`Failed to download OPA: ${err.message}`);
    console.error("Check your network connection and the version in opa.config.json");
    process.exit(1);
  }

  const actualHash = computeSha256(buffer);

  if (actualHash !== expectedChecksum) {
    console.error(`Checksum mismatch!`);
    console.error(`  Expected: ${expectedChecksum}`);
    console.error(`  Actual:   ${actualHash}`);
    console.error("The download may have been corrupted. Update opa.config.json if the version changed.");
    process.exit(1);
  }

  writeFileSync(cachedBinary, buffer);
  chmodSync(cachedBinary, 0o755);

  console.log(`OPA v${version} downloaded and verified at ${cachedBinary}`);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ opaPath: cachedBinary, version, platform: platformKey, binary: binaryName, cached: false }));
  }
}

bootstrap().catch((err) => {
  console.error("OPA bootstrap failed:", err.message);
  process.exit(1);
});