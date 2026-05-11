import { requireCoachAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  await requireCoachAccess();
  const { matchId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const { formationId, placements } = body as Record<string, unknown>;

  if (typeof formationId !== "string" || !formationId) {
    return NextResponse.json({ error: "formationId must be a non-empty string" }, { status: 400 });
  }

  if (!isStringRecord(placements)) {
    return NextResponse.json({ error: "placements must be a Record<string, string>" }, { status: 400 });
  }

  const match = await db.match.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  try {
    await db.match.update({
      where: { id: matchId },
      data: { formation: JSON.stringify({ formationId, placements }) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save formation";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}