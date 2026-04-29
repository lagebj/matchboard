import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound } from "@/lib/selection/save-generated-draft";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let roundId: unknown;
  try {
    const body = await request.json();
    roundId = body.roundId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!roundId || typeof roundId !== "string") {
    return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  }

  const matchRound = await db.matchRound.findUnique({
    where: { id: roundId },
    include: {
      matches: { select: { id: true } },
    },
  });

  if (!matchRound) {
    return NextResponse.json({ error: "Match round not found" }, { status: 404 });
  }

  try {
    const generatedRound = await generateMatchRound(roundId);
    await createGeneratedDraftRound(generatedRound);

    return NextResponse.json({
      roundId,
      matchCount: generatedRound.matchResults.length,
      roundWarnings: generatedRound.roundWarnings,
      generationSummary: generatedRound.generationSummary,
      matchResults: generatedRound.matchResults.map((result) => ({
        matchId: result.matchId,
        teamName: result.teamName,
        selectedCount: result.selectedPlayers.length,
        excludedCount: result.excludedPlayers.length,
        selectedPlayers: result.selectedPlayers.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          selectionCategory: p.selectionCategory,
          coreTeamName: p.coreTeamName,
        })),
        excludedPlayers: result.excludedPlayers.map((p) => ({
          playerId: p.playerId,
          playerName: p.playerName,
          automaticSelectionCategory: p.automaticSelectionCategory,
          coreTeamName: p.coreTeamName,
          exclusionReason: p.exclusionReason,
        })),
        warnings: result.warnings,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}