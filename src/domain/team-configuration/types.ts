export interface TeamConfiguration {
  teamId: string;
  name: string;
  coreGroup: string;
  active: boolean;
  targetSquadSize: number;
  maxSquadSize: number;
  supportPriority: number;
  footballGroupId: string | null;
  footballGroup: {
    id: string;
    name: string;
    slug: string;
    type: string;
  } | null;
  rules: TeamRuleConfiguration[];
}

export interface TeamRuleConfiguration {
  ruleId: string;
  name: string;
  description: string;
  scope: "GLOBAL" | "TEAM";
  enabled: boolean;
  editable: boolean;
  value?: string | number | boolean;
}

export interface UpdateTeamConfigurationInput {
  name?: string;
  active?: boolean;
  targetSquadSize?: number;
  maxSquadSize?: number;
  supportPriority?: number;
  footballGroupId?: string | null;
  rules?: Array<{
    ruleId: string;
    enabled?: boolean;
    value?: string | number | boolean;
  }>;
}