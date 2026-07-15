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

export { resolveOpaPath, detectPlatform, CACHE_DIR, REPO_ROOT, CONFIG_PATH };