import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getOrCreateDefaultGroup } from "@/lib/groups/group-domain";

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
  organisationId?: string | null;
};

export async function getRules(orgFilter?: OrgFilterMode): Promise<MatchboardRuleConfig> {
  const orgWhere = orgFilter?.type === 'org' ? orgFilter.filter : {};
  const existingRules = await db.ruleConfig.findFirst({
    where: orgWhere,
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      minDaysBetweenAnyMatches: true,
      name: true,
      version: true,
      warningThreshold: true,
      organisationId: true,
    },
  });

  if (existingRules) {
    return existingRules;
  }

  const organisationId = orgFilter?.type === 'org' ? orgFilter.organisationId : undefined;
  if (!organisationId) {
    throw new Error('Organisation context is required to create default rules.');
  }

  const footballGroupId = await getOrCreateDefaultGroup(organisationId);

  return db.ruleConfig.create({
    data: {
      ...defaultRuleConfigData,
      organisationId,
      footballGroupId,
    },
    select: {
      id: true,
      minDaysBetweenAnyMatches: true,
      name: true,
      version: true,
      warningThreshold: true,
      organisationId: true,
    },
  });
}