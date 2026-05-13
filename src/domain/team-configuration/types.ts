export interface TeamConfiguration {
  teamId: string;
  name: string;
  coreGroup: string;
  active: boolean;
  targetSquadSize: number;
  maxSquadSize: number;
  supportPriority: number;
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
  rules?: Array<{
    ruleId: string;
    enabled?: boolean;
    value?: string | number | boolean;
  }>;
}