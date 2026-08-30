import { NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  await requireActorContext();

  const rl = await rateLimit("workbench:diagnostics", 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const { getWorkbenchDiagnostics } = await import("@/lib/workbench/workbench-service");
  const diagnostics = getWorkbenchDiagnostics();

  return NextResponse.json({
    runtimeStatus: diagnostics.runtimeStatus,
    regoWasmLoaded: diagnostics.regoWasmLoaded,
    policyVersion: diagnostics.policyVersion,
    artifactHash: diagnostics.artifactHash,
    packId: diagnostics.packId,
    packVersion: diagnostics.packVersion,
    packFailureMode: diagnostics.packFailureMode,
  });
}