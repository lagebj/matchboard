import { NextResponse } from "next/server";
import { requireActorContext, requireAdminRole } from "@/lib/auth/actor-context";
import { getPolicyRuntimeDiagnostics } from "@/lib/policies/policy-runtime";
import { getActivePackDiagnostics } from "@/lib/policies/policy-pack";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireAdminRole(ctx);

  const runtimeDiagnostics = getPolicyRuntimeDiagnostics();
  const packDiagnostics = getActivePackDiagnostics();

  return NextResponse.json({
    policy: {
      layers: ["core-invariants", "default-matchboard-policy", "rego-wasm"],
      runtimeStatus: runtimeDiagnostics.status,
      lastRuntimeErrorCode: runtimeDiagnostics.lastRuntimeErrorCode ?? null,
      policyVersion: packDiagnostics.packId
        ? `policy-${packDiagnostics.packId}-${packDiagnostics.packVersion}-${packDiagnostics.artifactHash ?? "no-hash"}`
        : "default-typescript",
      policyArtifactHash: packDiagnostics.artifactHash,
      artifactLoaded: packDiagnostics.artifactLoaded,
      pack: {
        id: packDiagnostics.packId,
        version: packDiagnostics.packVersion,
        name: packDiagnostics.packName,
        schemaVersion: packDiagnostics.schemaVersion,
        entrypoints: packDiagnostics.entrypoints,
        failureMode: packDiagnostics.failureMode,
        validationErrors: packDiagnostics.validationErrors,
        validationWarnings: packDiagnostics.validationWarnings,
      },
    },
  });
}
