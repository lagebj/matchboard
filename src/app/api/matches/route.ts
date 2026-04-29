import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { formatDate } from "@/lib/date-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameFormatParam = url.searchParams.get("gameFormat");

  const validFormats = ["SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"] as const;
  const gameFormat = validFormats.find((f) => f === gameFormatParam);
  const where = gameFormat ? { gameFormat } : {};

  const matches = await db.match.findMany({
    where,
    include: { team: { select: { name: true } } },
    orderBy: [{ startsAt: "desc" }],
  });

  return NextResponse.json(
    matches.map((m) => ({
      id: m.id,
      label: `${m.team.name} vs. ${m.opponent} · ${formatDate(m.startsAt)}`,
      gameFormat: m.gameFormat,
      formation: m.formation,
    })),
  );
}