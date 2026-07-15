import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getWorkbenchDiagnostics } = await import("@/lib/workbench/workbench-service");
  const diagnostics = getWorkbenchDiagnostics();

  return NextResponse.json({
    regoEnabled: diagnostics.regoEnabled,
    regoWasmLoaded: diagnostics.regoWasmLoaded,
    policyVersion: diagnostics.policyVersion,
    artifactHash: diagnostics.artifactHash,
    packId: diagnostics.packId,
    packVersion: diagnostics.packVersion,
    failureMode: diagnostics.failureMode,
  });
}