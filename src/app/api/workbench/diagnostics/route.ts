import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit("workbench:diagnostics", 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
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