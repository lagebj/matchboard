import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const playerCount = await db.player.count();

    return NextResponse.json({
      ok: true,
      playerCount,
    });
  } catch {
    return NextResponse.json({ ok: false, playerCount: 0 }, { status: 503 });
  }
}