import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const CACHE_DIR = join(REPO_ROOT, ".opa-cache");
const CONFIG_PATH = join(REPO_ROOT, "opa.config.json");

function detectPlatform() {
  const os = process.platform;
  const arch = process.arch;
  if (os === "darwin" && arch === "arm64") return "darwin-arm64";
  if (os === "darwin" && arch === "x64") return "darwin-x64";
  if (os === "linux" && arch === "arm64") return "linux-arm64";
  if (os === "linux" && arch === "x64") return "linux-x64";
  return null;
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function resolveOpaPath() {
  const envPath = process.env.OPA_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const config = loadConfig();
  const platformKey = detectPlatform();

  if (platformKey && config?.platforms?.[platformKey]) {
    const binaryName = config.platforms[platformKey];
    const cachedBinary = join(CACHE_DIR, binaryName);
    if (existsSync(cachedBinary)) {
      return cachedBinary;
    }
  }

  try {
    execFileSync("opa", ["version"], { stdio: "pipe" });
    return "opa";
  } catch {
    console.error("OPA CLI not found. Run 'npm run policy:sync' to bootstrap OPA, or install it globally.");
    console.error("  macOS: brew install opa");
    console.error("  Linux: curl -L -o /usr/local/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64_static");
    console.error("  Or set OPA_PATH environment variable.");
    return null;
  }
}

/**
 * `opa build -t wasm` is not byte-reproducible across host CPU architectures (ARR-0037). The
 * committed policy Wasm artifact + its `wasmHash` are canonical for amd64 (`x64`) only — that is
 * what CI's `policy-verify` job enforces. Regenerating them (`policy:sync` / `policy:build*`)
 * from a non-x64 machine commits a wrong-architecture artifact that then fails CI. This gate
 * refuses that unless `--force` / `CI` / a matching `MATCHBOARD_POLICY_CANONICAL_ARCH`.
 */
function assertCanonicalArchForArtifactRegen(label) {
  const canonicalArch = process.env.MATCHBOARD_POLICY_CANONICAL_ARCH || "x64";
  if (process.arch === canonicalArch || process.env.CI || process.argv.includes("--force")) return;
  console.error(
    `\n[${label}] Refusing to regenerate the policy Wasm artifact on host arch '${process.arch}'.\n` +
      `  The committed artifact is canonical for '${canonicalArch}' only (ARR-0037): 'opa build\n` +
      `  -t wasm' is not byte-reproducible across architectures, so a rebuild here would commit a\n` +
      `  wrong-arch artifact that fails CI's amd64 policy-verify job.\n` +
      `  Let CI rebuild it (the policy-verify job uploads a ready-to-commit\n` +
      `  policy-wasm-rebuilt-<run-id> artifact), or pass --force if you know what you're doing.\n`,
  );
  process.exit(1);
}

export {
  resolveOpaPath,
  detectPlatform,
  assertCanonicalArchForArtifactRegen,
  CACHE_DIR,
  REPO_ROOT,
  CONFIG_PATH,
};