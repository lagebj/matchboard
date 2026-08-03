import { NextResponse } from "next/server";
import { requireActorContext, requireAdminRole } from "@/lib/auth/actor-context";
import { isRegoEnabled, getRegoFailureMode } from "@/lib/policies/rego-policy-adapter";
import { getActivePackDiagnostics } from "@/lib/policies/policy-pack";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireActorContext();
  requireAdminRole(ctx);
  const regoEnabled = isRegoEnabled();
  const regoFailureMode = getRegoFailureMode();
  const packDiagnostics = getActivePackDiagnostics();

  return NextResponse.json({
    policy: {
      layers: ["core-invariants", "default-matchboard-policy", regoEnabled ? "rego-wasm" : null].filter(Boolean),
      regoEnabled,
      regoFailureMode,
      policyVersion: packDiagnostics.packId
        ? `rego-${packDiagnostics.packId}-${packDiagnostics.packVersion}-${packDiagnostics.artifactHash ?? "no-hash"}`
        : "default-typescript",
      policyArtifactHash: packDiagnostics.artifactHash,
      artifactLoaded: packDiagnostics.artifactLoaded,
      pack: regoEnabled
        ? {
            id: packDiagnostics.packId,
            version: packDiagnostics.packVersion,
            name: packDiagnostics.packName,
            validationErrors: packDiagnostics.validationErrors,
            validationWarnings: packDiagnostics.validationWarnings,
          }
        : null,
    },
  });
}