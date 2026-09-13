export interface TeamConfiguration {
  teamId: string;
  name: string;
  coreGroup: string;
  active: boolean;
  /** Atlas Follow-up: validated `KitColorId` (`src/lib/teams/kit-color.ts`), or `null` for unset. */
  kitColor: string | null;
  targetSquadSize: number;
  minAcceptedSquadSize: number;
  maxSquadSize: number;
  minCorePlayers: number;
  supportPriority: number;
  minSupportPlayers: number;
  developmentSlots: number;
  footballGroupId: string;
  footballGroup: {
    id: string;
    name: string;
    slug: string;
    type: string;
  };
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
  /** Set to `null` to clear (revert to the neutral Touchline shirt). */
  kitColor?: string | null;
  targetSquadSize?: number;
  minAcceptedSquadSize?: number;
  maxSquadSize?: number;
  minCorePlayers?: number;
  supportPriority?: number;
  minSupportPlayers?: number;
  developmentSlots?: number;
  footballGroupId?: string;
  rules?: Array<{
    ruleId: string;
    enabled?: boolean;
    value?: string | number | boolean;
  }>;
}