import type { MatchboardRuleConfig } from "@/lib/rules/get-rules";

export type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type ValidationIssue = {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type TeamValidationData = {
  id: string;
  maxSquadSize: number;
  minAcceptedSquadSize: number;
  minCorePlayers: number;
  minSupportCount: number;
  targetSquadSize: number;
};

export type PathValidationData = {
  fromTeamId: string;
  role: string;
  toTeamId: string;
};

export function validateTeamConfiguration(
  teams: TeamValidationData[],
  paths: PathValidationData[],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const team of teams) {
    if (team.targetSquadSize < team.minAcceptedSquadSize) {
      errors.push({
        code: "team_target_below_min_accepted",
        field: "targetSquadSize",
        message: `Team ${team.id} has target squad size ${team.targetSquadSize} which is below its minimum accepted squad size ${team.minAcceptedSquadSize}. Target squad size cannot be lower than minimum accepted squad size.`,
        severity: "error",
      });
    }

    if (team.minCorePlayers + team.minSupportCount > team.maxSquadSize) {
      errors.push({
        code: "team_min_core_plus_support_exceeds_max",
        field: "maxSquadSize",
        message: `Team ${team.id} has minimum core players (${team.minCorePlayers}) plus minimum support count (${team.minSupportCount}) = ${team.minCorePlayers + team.minSupportCount}, which exceeds maximum squad size (${team.maxSquadSize}).`,
        severity: "error",
      });
    }
  }

  const teamsNeedingSupport = teams.filter((team) => team.minSupportCount > 0);
  for (const team of teamsNeedingSupport) {
    const hasSupportPath = paths.some(
      (path) => path.toTeamId === team.id && path.role === "SUPPORT",
    );
    if (!hasSupportPath) {
      errors.push({
        code: "team_support_no_source_path",
        field: "minSupportCount",
        message: `Team ${team.id} requires at least ${team.minSupportCount} support player(s) but no rotation path allows any team to support it. Add a support path or reduce the minimum support count.`,
        severity: "error",
      });
    }
  }

  const backfillPaths = paths.filter(
    (path) => path.role.toUpperCase() === "BACKFILL",
  );
  const backfillAdjacency = new Map<string, Set<string>>();
  for (const path of backfillPaths) {
    if (!backfillAdjacency.has(path.fromTeamId)) {
      backfillAdjacency.set(path.fromTeamId, new Set());
    }
    backfillAdjacency.get(path.fromTeamId)!.add(path.toTeamId);
  }

  for (const team of teams) {
    if (!backfillAdjacency.has(team.id)) continue;
    const visited = new Set<string>();
    const queue = [team.id];
    let foundCycle = false;

    while (queue.length > 0 && !foundCycle) {
      const current = queue.pop()!;
      const neighbors = backfillAdjacency.get(current);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (neighbor === team.id) {
          foundCycle = true;
          break;
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (foundCycle) {
      warnings.push({
        code: "backfill_cycle_detected",
        field: "rotationPaths",
        message: `Squad repair configuration creates a potential cycle involving team ${team.id}. The engine will stop if a team would appear twice in the same squad repair chain.`,
        severity: "warning",
      });
    }
  }

  return { errors, warnings };
}

export function validateRuleConfig(
  rules: MatchboardRuleConfig,
  context?: {
    teamCount?: number;
    existingPathCount?: number;
  },
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (rules.name.trim().length === 0) {
    errors.push({
      code: "rules_name_empty",
      field: "name",
      message: "Rule configuration name must not be empty.",
      severity: "error",
    });
  }

  if (rules.minDaysBetweenAnyMatches < 0) {
    errors.push({
      code: "rules_min_days_negative",
      field: "minDaysBetweenAnyMatches",
      message: "Minimum days between matches must not be negative.",
      severity: "error",
    });
  }

  if (rules.minDaysBetweenAnyMatches > 7) {
    warnings.push({
      code: "rules_min_days_high",
      field: "minDaysBetweenAnyMatches",
      message: "Setting minimum days above 7 may severely limit multi-match availability in a single week.",
      severity: "warning",
    });
  }

  if (rules.warningThreshold < 0) {
    errors.push({
      code: "rules_warning_threshold_negative",
      field: "warningThreshold",
      message: "Warning threshold must not be negative.",
      severity: "error",
    });
  }

  if (rules.warningThreshold === 0) {
    warnings.push({
      code: "rules_warning_threshold_zero",
      field: "warningThreshold",
      message: "Warning threshold of 0 means any warning blocks finalization. Consider setting a higher threshold.",
      severity: "warning",
    });
  }

  if (context) {
    if (context.existingPathCount !== undefined && context.existingPathCount === 0) {
      warnings.push({
        code: "rules_no_paths_configured",
        field: "minDaysBetweenAnyMatches",
        message: "No rotation paths are configured. Players can only be selected for their core team until paths are defined.",
        severity: "warning",
      });
    }
  }

  return { errors, warnings };
}

export type RuleExportData = {
  exportedAt: string;
  version: number;
  rules: MatchboardRuleConfig;
};

export function exportRuleConfig(rules: MatchboardRuleConfig): RuleExportData {
  return {
    exportedAt: new Date().toISOString(),
    version: rules.version,
    rules: {
      id: rules.id,
      name: rules.name,
      minDaysBetweenAnyMatches: rules.minDaysBetweenAnyMatches,
      version: rules.version,
      warningThreshold: rules.warningThreshold,
    },
  };
}

export function validateImportedRuleConfig(data: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!data || typeof data !== "object") {
    errors.push({
      code: "import_invalid_format",
      field: "root",
      message: "Imported data must be a valid object.",
      severity: "error",
    });
    return { errors, warnings };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.name !== "string" || obj.name.trim().length === 0) {
    errors.push({
      code: "import_name_missing",
      field: "name",
      message: "Imported rule config must have a non-empty name.",
      severity: "error",
    });
  }

  if (typeof obj.minDaysBetweenAnyMatches !== "number" || obj.minDaysBetweenAnyMatches < 0) {
    errors.push({
      code: "import_field_type",
      field: "minDaysBetweenAnyMatches",
      message: "minDaysBetweenAnyMatches must be a non-negative number.",
      severity: "error",
    });
  }

  if (typeof obj.warningThreshold !== "number" || obj.warningThreshold < 0) {
    errors.push({
      code: "import_field_type",
      field: "warningThreshold",
      message: "warningThreshold must be a non-negative number.",
      severity: "error",
    });
  }

  if (errors.length === 0) {
    const rules = obj as unknown as MatchboardRuleConfig;
    const deeperValidation = validateRuleConfig(rules);
    errors.push(...deeperValidation.errors);
    warnings.push(...deeperValidation.warnings);
  }

  return { errors, warnings };
}