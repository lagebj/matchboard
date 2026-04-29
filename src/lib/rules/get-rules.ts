import { db } from "@/lib/db";

const defaultRuleConfigData = {
  minDaysBetweenAnyMatches: 3,
  name: "Default ruleset",
  version: 1,
  warningThreshold: 3,
} as const;

export type MatchboardRuleConfig = {
  id: string;
  minDaysBetweenAnyMatches: number;
  name: string;
  version: number;
  warningThreshold: number;
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