import { db } from "@/lib/db";
import {
  validateMatchFormatDefinition,
  type MatchFormatDefinition,
} from "@/lib/live-match/match-format";

export type UpdateLeagueSeasonMatchFormatResult =
  | { success: true; format: MatchFormatDefinition }
  | { success: false; error: string };

/**
 * Sets/replaces a LeagueSeason's default match format (ADR-0146 §1). Existing legacy seasons
 * stay unconfigured (`null`) until a coach explicitly calls this -- never inferred or defaulted
 * automatically. Changing this does not touch any match that has already frozen its effective
 * format at Live Reporting start (freeze wiring is a later slice of this programme; this function
 * only ever writes LeagueSeason's own default fields).
 */
export async function updateLeagueSeasonMatchFormat(
  leagueSeasonId: string,
  organisationId: string,
  format: MatchFormatDefinition,
): Promise<UpdateLeagueSeasonMatchFormatResult> {
  const errors = validateMatchFormatDefinition(format);
  if (errors.length > 0) {
    return { success: false, error: `Invalid match format: ${errors.join(", ")}` };
  }

  const season = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId, organisationId },
    select: { id: true },
  });
  if (!season) {
    return { success: false, error: "League season not found or access denied." };
  }

  await db.leagueSeason.update({
    where: { id: leagueSeasonId },
    data: {
      defaultNumberOfPeriods: format.numberOfPeriods,
      defaultPeriodDurationMinutes: format.periodDurationMinutes,
      defaultBreakDurationMinutes: format.breakDurationMinutes,
    },
  });

  return { success: true, format };
}
