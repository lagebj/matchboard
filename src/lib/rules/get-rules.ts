import { db } from "@/lib/db";

const defaultRuleConfigData = {
  name: "Default ruleset",
  enforceCorePlayers: true,
  allowCoreMatchDrop: true,
  maxCoreMatchDropsPerPlayer: 1,
  maxTotalFloatMatches: 3,
  preventConsecutiveFloat: true,
  minDaysBetweenAnyMatches: 3,
  blockCoreMatchIfFloatingWithinDays: 2,
  preferPositionBalance: true,
  preferLowRecentLoad: true,
  preferLowerFloatCount: true,
} as const;

export type MatchboardRuleConfig = {
  allowCoreMatchDrop: boolean;
  blockCoreMatchIfFloatingWithinDays: number;
  enforceCorePlayers: boolean;
  id: string;
  maxCoreMatchDropsPerPlayer: number;
  maxTotalFloatMatches: number;
  minDaysBetweenAnyMatches: number;
  name: string;
  preferLowRecentLoad: boolean;
  preferLowerFloatCount: boolean;
  preferPositionBalance: boolean;
  preventConsecutiveFloat: boolean;
};

export async function getRules(): Promise<MatchboardRuleConfig> {
  const existingRules = await db.ruleConfig.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingRules) {
    return existingRules;
  }

  return db.ruleConfig.create({
    data: defaultRuleConfigData,
  });
}
