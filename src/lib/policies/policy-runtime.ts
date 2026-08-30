import { readFileSync, existsSync } from "node:fs";
import { logger } from "@/lib/logger";
import {
  getActivePackId,
  loadPackMetadata,
  resolveWasmPath,
  getPackEntrypoint,
  computeArtifactHash,
  clearPackCaches,
  type PolicyPackMetadata,
} from "./policy-pack";

/**
 * The single OPA/Rego Wasm runtime owner (ADR: OPA/Rego standard runtime).
 *
 * Owns: active pack selection, metadata loading, Wasm artifact loading, OPA module
 * loading, cache lifecycle, named-entrypoint evaluation, the normalization boundary, and
 * runtime health/degradation tracking. Typed adapters (selection, situation) sit above
 * this and must not load Wasm or the OPA module themselves.
 */

export type PolicyEntrypointName = "selection" | "situation";

export type PolicyRuntimeHealthStatus = "HEALTHY" | "DEGRADED";

export type PolicyRuntimeDiagnostics = {
  runtime: "opa-wasm";
  status: PolicyRuntimeHealthStatus;
  packId: string | null;
  packVersion: string | null;
  schemaVersion: number | null;
  artifactHash: string | null;
  artifactLoaded: boolean;
  entrypoints: string[];
  validationErrors: string[];
  validationWarnings: string[];
  lastRuntimeErrorCode?: string;
};

/** Hard failure for a pack whose declared failureMode is "fail_closed" (never the built-in pack). */
export class PolicyRuntimeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PolicyRuntimeError";
  }
}

/**
 * Thrown when the built-in pack (or any "degraded_fallback" pack) fails to load or
 * evaluate unexpectedly. Callers must catch this and apply their own entrypoint-specific
 * safe fallback — this class carries no fallback shape of its own, since "selection" and
 * "situation" have different empty/neutral result shapes.
 */
export class PolicyRuntimeDegradedError extends Error {
  constructor(message: string, public readonly errorCode: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PolicyRuntimeDegradedError";
  }
}

type OpaPolicy = {
  entrypoints: Record<string, number>;
  evaluate: (input: unknown, entrypoint?: string | number) => unknown[];
};

let runtimeStatus: PolicyRuntimeHealthStatus = "HEALTHY";
let lastRuntimeErrorCode: string | undefined;

let cachedWasmPath: string | null = null;
let cachedPolicyPromise: Promise<OpaPolicy> | null = null;

function resolveActiveWasmPath(): { packId: string; metadata: PolicyPackMetadata; wasmPath: string } {
  const explicitPath = process.env.MATCHBOARD_POLICY_WASM_PATH;
  const packId = getActivePackId();
  const metadata = loadPackMetadata(packId);

  if (!metadata) {
    throw new PolicyRuntimeError(
      `Policy pack '${packId}' not found or metadata invalid. Check MATCHBOARD_POLICY_PACK_ID and ensure the pack directory exists.`,
    );
  }

  const wasmPath = explicitPath ?? resolveWasmPath(packId, metadata);
  return { packId, metadata, wasmPath };
}

async function loadWasmBuffer(wasmPath: string): Promise<Buffer> {
  if (!existsSync(wasmPath)) {
    throw new Error(`Compiled Wasm policy not found at ${wasmPath}. Run 'npm run policy:build -- --pack <id>' to compile.`);
  }
  return readFileSync(wasmPath);
}

async function loadOpaModule(): Promise<typeof import("@open-policy-agent/opa-wasm")> {
  return import("@open-policy-agent/opa-wasm");
}

async function loadPolicy(wasmPath: string): Promise<OpaPolicy> {
  const opaModule = await loadOpaModule();
  const buffer = await loadWasmBuffer(wasmPath);
  const policy = await opaModule.loadPolicy(buffer);
  return policy as OpaPolicy;
}

function getCachedPolicy(wasmPath: string): Promise<OpaPolicy> {
  if (cachedWasmPath !== wasmPath) {
    cachedPolicyPromise = null;
    cachedWasmPath = wasmPath;
  }
  if (!cachedPolicyPromise) {
    cachedPolicyPromise = loadPolicy(wasmPath);
  }
  return cachedPolicyPromise;
}

export function clearPolicyRuntimeCache(): void {
  cachedWasmPath = null;
  cachedPolicyPromise = null;
  clearPackCaches();
  runtimeStatus = "HEALTHY";
  lastRuntimeErrorCode = undefined;
}

function markDegraded(errorCode: string, message: string, error: unknown): void {
  runtimeStatus = "DEGRADED";
  lastRuntimeErrorCode = errorCode;
  logger.error({ errorCode, message: error instanceof Error ? error.message : String(error) }, `[Policy/Runtime] ${message}`);
}

/**
 * Evaluate a named policy entrypoint ("selection" | "situation") against normalized input.
 *
 * Throws `PolicyRuntimeError` for a pack explicitly configured `fail_closed` (never the
 * built-in pack). Throws `PolicyRuntimeDegradedError` for the built-in pack (or any pack
 * left at the default `degraded_fallback`) — callers must catch this and apply their own
 * safe, entrypoint-specific fallback; this function never silently swallows a failure.
 */
export async function evaluatePolicyEntrypoint<TRawResult = unknown>(
  entrypointName: PolicyEntrypointName,
  input: unknown,
): Promise<TRawResult> {
  let packId: string;
  let metadata: PolicyPackMetadata;
  let wasmPath: string;

  try {
    ({ packId, metadata, wasmPath } = resolveActiveWasmPath());
  } catch (error) {
    return handleFailure(entrypointName, getActivePackId(), "degraded_fallback", "pack_resolution_failed", error);
  }

  try {
    const entrypointPath = getPackEntrypoint(metadata, entrypointName);
    const policy = await getCachedPolicy(wasmPath);
    const results = policy.evaluate(input, entrypointPath);

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`Policy entrypoint '${entrypointName}' returned empty or invalid result.`);
    }

    const decision = results[0];
    if (decision == null || typeof decision !== "object") {
      throw new Error(`Policy entrypoint '${entrypointName}' decision is null or non-object.`);
    }

    const result = (decision as Record<string, unknown>).result ?? decision;
    runtimeStatus = "HEALTHY";
    lastRuntimeErrorCode = undefined;
    return result as TRawResult;
  } catch (error) {
    return handleFailure(entrypointName, packId, metadata.failureMode, "evaluation_failed", error);
  }
}

function handleFailure<TRawResult>(
  entrypointName: PolicyEntrypointName,
  packId: string,
  failureMode: "degraded_fallback" | "fail_closed",
  errorCode: string,
  error: unknown,
): TRawResult {
  const message = error instanceof Error ? error.message : String(error);

  if (failureMode === "fail_closed") {
    throw new PolicyRuntimeError(
      `Policy entrypoint '${entrypointName}' evaluation failed for pack '${packId}' (fail_closed): ${message}`,
      error,
    );
  }

  markDegraded(errorCode, `entrypoint '${entrypointName}' failed for pack '${packId}': ${message}`, error);
  throw new PolicyRuntimeDegradedError(
    `Policy entrypoint '${entrypointName}' evaluation degraded for pack '${packId}': ${message}`,
    errorCode,
    error,
  );
}

export function getPolicyRuntimeDiagnostics(): PolicyRuntimeDiagnostics {
  const packId = getActivePackId();
  const metadata = loadPackMetadata(packId);

  if (!metadata) {
    return {
      runtime: "opa-wasm",
      status: "DEGRADED",
      packId,
      packVersion: null,
      schemaVersion: null,
      artifactHash: null,
      artifactLoaded: false,
      entrypoints: [],
      validationErrors: [`Pack '${packId}' not found or metadata invalid`],
      validationWarnings: [],
      lastRuntimeErrorCode,
    };
  }

  const wasmPath = resolveWasmPath(packId, metadata);
  const artifactHash = computeArtifactHash(wasmPath);

  return {
    runtime: "opa-wasm",
    status: runtimeStatus,
    packId: metadata.id,
    packVersion: metadata.version,
    schemaVersion: metadata.schemaVersion,
    artifactHash,
    artifactLoaded: artifactHash !== null,
    entrypoints: Object.keys(metadata.entrypoints),
    validationErrors: [],
    validationWarnings: [],
    lastRuntimeErrorCode,
  };
}
