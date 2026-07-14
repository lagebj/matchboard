import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { isRegoEnabled } from "./rego-policy-adapter";

let cachedPolicyHash: string | null = null;

function getWasmPath(): string {
  return process.env.MATCHBOARD_POLICY_WASM_PATH ?? join(process.cwd(), "policies", "compiled", "matchboard_selection.wasm");
}

export function getPolicyArtifactHash(): string | null {
  if (!isRegoEnabled()) {
    return null;
  }

  if (cachedPolicyHash !== null) {
    return cachedPolicyHash;
  }

  const wasmPath = getWasmPath();

  try {
    if (!existsSync(wasmPath)) {
      return null;
    }
    const buffer = readFileSync(wasmPath);
    cachedPolicyHash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    return cachedPolicyHash;
  } catch {
    return null;
  }
}

export function getPolicyVersion(): string {
  const hash = getPolicyArtifactHash();
  if (hash) {
    return `rego-${hash}`;
  }
  return "default-typescript";
}

export function clearPolicyHashCache(): void {
  cachedPolicyHash = null;
}