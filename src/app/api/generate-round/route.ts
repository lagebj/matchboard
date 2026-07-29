import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound } from "@/lib/selection/save-generated-draft";
import { buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";
import { persistRoundExplanations } from "@/lib/selection/persist-explanations";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { generateRoundSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";

export async function POST(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("generate-round", 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many generation requests. Please wait a moment and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = generateRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const { roundId } = parsed.data;

  const matchRound = await db.matchRound.findUnique({
    where: { id: roundId },
    include: {
      matches: {
        include: {
          team: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!matchRound) {
    return NextResponse.json({ error: "Match round not found" }, { status: 404 });
  }

  try {
    const generatedRound = await generateMatchRound(roundId);
    await createGeneratedDraftRound(generatedRound);

    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const match of matchRound.matches) {
      matchIdByTeamName.set(match.team.name, match.id);
      teamIdByTeamName.set(match.team.name, match.team.id);
    }

    const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
    await persistRoundWarnings(warnings);
    await persistRoundExplanations(generatedRound);

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
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}