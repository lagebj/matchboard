import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit("workbench:fixtures", 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  try {
    const { getWorkbenchFixtureList } = await import("@/lib/workbench/workbench-service");
    const fixtures = await getWorkbenchFixtureList();
    return NextResponse.json(fixtures);
  } catch (error) {
    const { error: message } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}