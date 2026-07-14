import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getWorkbenchFixtureList } = await import("@/lib/workbench/workbench-service");
    const fixtures = await getWorkbenchFixtureList();
    return NextResponse.json(fixtures);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}