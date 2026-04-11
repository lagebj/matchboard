import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const playerCount = await db.player.count();

  return NextResponse.json({
    ok: true,
    playerCount,
  });
}
