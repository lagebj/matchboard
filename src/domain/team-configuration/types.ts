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
  /** Match-format override (ADR-0146) — `null` means "use the League Season match format";
   * a set value is a complete override, never merged field-by-field. */
  matchFormatOverride: { numberOfPeriods: number; periodDurationMinutes: number; breakDurationMinutes: number } | null;
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
  /** Set a complete format to override, or `null` to clear the override (revert to the League
   * Season match format). `undefined` (omitted) leaves it unchanged. */
  matchFormatOverride?: { numberOfPeriods: number; periodDurationMinutes: number; breakDurationMinutes: number } | null;
  footballGroupId?: string;
  rules?: Array<{
    ruleId: string;
    enabled?: boolean;
    value?: string | number | boolean;
  }>;
}