#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REGO_DIR = join(process.cwd(), "policies", "rego");
const COMPILED_DIR = join(process.cwd(), "policies", "compiled");
const WASM_OUTPUT = join(COMPILED_DIR, "matchboard_selection.wasm");
const ENTRYPOINT = "matchboard/selection/decision";

function checkOpaCli() {
  try {
    execFileSync("opa", ["version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function buildPolicy() {
  if (!checkOpaCli()) {
    console.error("OPA CLI not found. Install it from https://www.openpolicyagent.org/docs/latest/#running-opa");
    console.error("  macOS: brew install opa");
    console.error("  Linux: curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64_static");
    console.error("  Then: chmod +x /usr/local/bin/opa");
    process.exit(1);
  }

  if (!existsSync(REGO_DIR)) {
    console.error(`Rego source directory not found: ${REGO_DIR}`);
    process.exit(1);
  }

  mkdirSync(COMPILED_DIR, { recursive: true });

  const tempBundle = join(tmpdir(), `matchboard-policy-${Date.now()}.tar.gz`);
  const tempExtractDir = join(tmpdir(), `matchboard-extract-${Date.now()}`);

  try {
    console.log("Building Rego policy...");
    execFileSync("opa", [
      "build",
      REGO_DIR,
      "-t", "wasm",
      "-e", ENTRYPOINT,
      "-o", tempBundle,
    ], { stdio: "pipe" });

    console.log("Extracting policy.wasm from bundle...");
    mkdirSync(tempExtractDir, { recursive: true });

    execFileSync("tar", ["-xzf", tempBundle, "-C", tempExtractDir], { stdio: "pipe" });

    const wasmPath = join(tempExtractDir, "policy.wasm");
    if (!existsSync(wasmPath)) {
      console.error("policy.wasm not found in bundle. Bundle contents:");
      try {
        const listing = execFileSync("tar", ["-tzf", tempBundle], { encoding: "utf-8" });
        console.error(listing);
      } catch {}
      process.exit(1);
    }

    writeFileSync(WASM_OUTPUT, readFileSync(wasmPath));
    console.log(`Compiled Wasm artifact written to: ${WASM_OUTPUT}`);

    console.log("Build complete.");
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
  } finally {
    try { unlinkSync(tempBundle); } catch {}
    try { rmSync(tempExtractDir, { recursive: true, force: true }); } catch {}
  }
}

buildPolicy();