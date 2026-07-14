import { NextResponse } from "next/server";
import { isRegoEnabled, getRegoFailureMode } from "@/lib/policies/rego-policy-adapter";
import { getPolicyArtifactHash, getPolicyVersion } from "@/lib/policies/policy-version";

export const runtime = "nodejs";

export async function GET() {
  const regoEnabled = isRegoEnabled();
  const regoFailureMode = getRegoFailureMode();
  const policyArtifactHash = getPolicyArtifactHash();
  const policyVersion = getPolicyVersion();

  return NextResponse.json({
    policy: {
      layers: ["core-invariants", "default-matchboard-policy", regoEnabled ? "rego-wasm" : null].filter(Boolean),
      regoEnabled,
      regoFailureMode,
      policyVersion,
      policyArtifactHash,
      artifactLoaded: regoEnabled ? policyArtifactHash !== null : null,
    },
  });
}