import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SelectionPolicyInput, SelectionPolicyResult, PolicyWarning, PolicyScoreAdjustment, PolicyExplanation, PolicyTag } from "./types";
import { SelectionPolicyAdapter } from "./selection-policy-adapter";

const SCORE_ADJUSTMENT_MIN = -20;
const SCORE_ADJUSTMENT_MAX = 20;

function getWasmPath(): string {
  return process.env.MATCHBOARD_POLICY_WASM_PATH ?? join(process.cwd(), "policies", "compiled", "matchboard_selection.wasm");
}

function readRegoEnabled(): boolean {
  return (process.env.MATCHBOARD_POLICY_REGO_ENABLED ?? "false") === "true";
}

function readRegoFailureMode(): "fail_closed" | "fail_open" {
  return (process.env.MATCHBOARD_POLICY_REGO_FAILURE_MODE ?? "fail_closed") === "fail_open" ? "fail_open" : "fail_closed";
}

type OpaPolicy = {
  evaluate: (input: unknown, options?: { entrypoint?: string | number }) => unknown[];
};

let cachedWasmBufferPromise: Promise<Buffer> | null = null;

async function loadWasmBuffer(): Promise<Buffer> {
  const wasmPath = getWasmPath();

  if (!existsSync(wasmPath)) {
    throw new RegoPolicyError(
      `Compiled Wasm policy not found at ${wasmPath}. ` +
      `Run 'npm run policy:build' to compile Rego source, or set MATCHBOARD_POLICY_WASM_PATH.`
    );
  }

  return readFileSync(wasmPath);
}

function getCachedWasmBuffer(): Promise<Buffer> {
  if (!cachedWasmBufferPromise) {
    cachedWasmBufferPromise = loadWasmBuffer();
  }
  return cachedWasmBufferPromise;
}

async function loadOpaModule(): Promise<typeof import("@open-policy-agent/opa-wasm")> {
  return import("@open-policy-agent/opa-wasm");
}

async function loadAndCreatePolicy(): Promise<OpaPolicy> {
  const opaModule = await loadOpaModule();
  const wasmBuffer = await getCachedWasmBuffer();
  const policy = await opaModule.loadPolicy(wasmBuffer);
  return policy as OpaPolicy;
}

let cachedPolicy: Promise<OpaPolicy> | null = null;

function getPolicy(): Promise<OpaPolicy> {
  if (!cachedPolicy) {
    cachedPolicy = loadAndCreatePolicy();
  }
  return cachedPolicy;
}

export function clearRegoPolicyCache(): void {
  cachedPolicy = null;
  cachedWasmBufferPromise = null;
}

export class RegoPolicyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RegoPolicyError";
  }
}

function normalizeRegoResult(raw: unknown, input: SelectionPolicyInput): SelectionPolicyResult {
  if (raw == null || typeof raw !== "object") {
    throw new RegoPolicyError("Rego policy returned null or non-object result.");
  }

  const result = raw as Record<string, unknown>;

  const blocked: Record<string, string[]> = {};
  const warnings: PolicyWarning[] = [];
  const scoreAdjustments: PolicyScoreAdjustment[] = [];
  const explanations: PolicyExplanation[] = [];
  const tags: PolicyTag[] = [];

  if (Array.isArray(result.blocked)) {
    for (const entry of result.blocked) {
      if (entry == null || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const playerId = String(e.player_id ?? e.playerId ?? "");
      const reasons = Array.isArray(e.reasons) ? e.reasons.map(String) : [String(e.reasons ?? "blocked_by_rego_policy")];
      if (playerId && reasons.length > 0) {
        blocked[playerId] = [...new Set([...(blocked[playerId] ?? []), ...reasons])];
      }
    }
  }

  if (Array.isArray(result.warnings)) {
    for (const w of result.warnings) {
      if (w == null || typeof w !== "object") continue;
      const warning = w as Record<string, unknown>;
      warnings.push({
        code: String(warning.code ?? "rego_warning"),
        severity: normalizeSeverity(warning.severity),
        message: String(warning.message ?? "Warning from Rego policy."),
        playerId: warning.player_id != null ? String(warning.player_id) : undefined,
        teamId: warning.team_id != null ? String(warning.team_id) : undefined,
        matchId: warning.match_id != null ? String(warning.match_id) : undefined,
        eventId: warning.event_id != null ? String(warning.event_id) : undefined,
      });
    }
  }

  if (Array.isArray(result.score_adjustments)) {
    for (const adj of result.score_adjustments) {
      if (adj == null || typeof adj !== "object") continue;
      const a = adj as Record<string, unknown>;
      const rawDelta = typeof a.delta === "number" ? a.delta : 0;
      const clampedDelta = Math.max(SCORE_ADJUSTMENT_MIN, Math.min(SCORE_ADJUSTMENT_MAX, rawDelta));
      scoreAdjustments.push({
        playerId: String(a.player_id ?? a.playerId ?? ""),
        delta: clampedDelta,
        reason: String(a.reason ?? "Score adjustment from Rego policy."),
        code: String(a.code ?? "rego_score_adjustment"),
      });
    }
  }

  if (Array.isArray(result.explanations)) {
    for (const exp of result.explanations) {
      if (exp == null || typeof exp !== "object") continue;
      const e = exp as Record<string, unknown>;
      explanations.push({
        playerId: String(e.player_id ?? e.playerId ?? ""),
        code: String(e.code ?? "rego_explanation"),
        summary: String(e.summary ?? "Explanation from Rego policy."),
        hardRule: e.hard_rule === true || e.hardRule === true,
      });
    }
  }

  if (Array.isArray(result.tags)) {
    for (const t of result.tags) {
      if (t == null || typeof t !== "object") continue;
      const tag = t as Record<string, unknown>;
      tags.push({
        playerId: String(tag.player_id ?? tag.playerId ?? ""),
        tag: String(tag.tag ?? tag.code ?? "rego_tag"),
        reason: String(tag.reason ?? "Tag from Rego policy."),
      });
    }
  }

  const allBlockedIds = new Set(Object.keys(blocked));
  const allowedPlayerIds = input.players
    .filter((p) => !allBlockedIds.has(p.id))
    .map((p) => p.id);

  return {
    allowedPlayerIds,
    blocked,
    warnings,
    scoreAdjustments,
    explanations,
    tags,
  };
}

function normalizeSeverity(severity: unknown): "info" | "warning" | "blocking" {
  if (severity === "info" || severity === "warning" || severity === "blocking") {
    return severity;
  }
  return "warning";
}

export class RegoPolicyAdapter implements SelectionPolicyAdapter {
  id = "rego-custom";
  name = "Rego Custom Policy";
  private policyPromise: Promise<OpaPolicy> | null = null;

  constructor(private options?: { wasmPath?: string }) {}

  async evaluate(input: SelectionPolicyInput): Promise<SelectionPolicyResult> {
    if (!readRegoEnabled()) {
      return {
        allowedPlayerIds: input.players.map((p) => p.id),
        blocked: {},
        warnings: [],
        scoreAdjustments: [],
        explanations: [],
        tags: [],
      };
    }

    try {
      if (!this.policyPromise) {
        this.policyPromise = this.options?.wasmPath
          ? this.loadPolicyFromPath(this.options.wasmPath)
          : getPolicy();
      }

      const policy = await this.policyPromise;
      const regoInput = this.transformInput(input);
      const results = policy.evaluate(regoInput);

      if (!Array.isArray(results) || results.length === 0) {
        throw new RegoPolicyError("Rego policy returned empty or invalid result.");
      }

      const decision = results[0];
      if (decision == null || typeof decision !== "object") {
        throw new RegoPolicyError("Rego policy decision is null or non-object.");
      }

      const result = (decision as Record<string, unknown>).result ?? decision;
      return normalizeRegoResult(result, input);
    } catch (error) {
      if (error instanceof RegoPolicyError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error("[Policy/Rego] Evaluation failed:", message);

      if (readRegoFailureMode() === "fail_open") {
        console.warn("[Policy/Rego] fail_open mode: returning empty result (default policy still applies).");
        return {
          allowedPlayerIds: input.players.map((p) => p.id),
          blocked: {},
          warnings: [],
          scoreAdjustments: [],
          explanations: [],
          tags: [],
        };
      }

      throw new RegoPolicyError(
        `Rego policy evaluation failed (fail_closed): ${message}`,
        error
      );
    }
  }

  private async loadPolicyFromPath(wasmPath: string): Promise<OpaPolicy> {
    const opaModule = await loadOpaModule();
    if (!existsSync(wasmPath)) {
      throw new RegoPolicyError(`Wasm policy file not found: ${wasmPath}`);
    }
    const buffer = readFileSync(wasmPath);
    return opaModule.loadPolicy(buffer) as Promise<OpaPolicy>;
  }

  private transformInput(input: SelectionPolicyInput): Record<string, unknown> {
    return {
      context: {
        ...input.context,
        nowIso: input.context.nowIso,
      },
      players: input.players.map((p) => ({
        id: p.id,
        display_name: p.displayName,
        status: p.status,
        available_for_context: p.availableForContext,
        unavailable_reason: p.unavailableReason ?? null,
        primary_position: p.primaryPosition ?? null,
        secondary_position: p.secondaryPosition ?? null,
        tertiary_position: p.tertiaryPosition ?? null,
        shirt_number: p.shirtNumber ?? null,
        current_team_ids: p.currentTeamIds,
        recent_match_count: p.recentMatchCount ?? 0,
        season_match_count: p.seasonMatchCount ?? 0,
        period_match_count: p.periodMatchCount ?? 0,
        goalkeeper_ability: p.goalkeeperAbility ?? null,
        non_rotatable: p.nonRotatable ?? false,
        policy_tags: (p as Record<string, unknown>).policyTags ?? [],
      })),
      teams: input.teams.map((t) => ({
        id: t.id,
        name: t.name,
        target_squad_size: t.targetSquadSize ?? null,
        min_squad_size: t.minSquadSize ?? null,
        max_squad_size: t.maxSquadSize ?? null,
      })),
      squads: input.squads.map((s) => ({
        id: s.id,
        name: s.name ?? null,
        team_id: s.teamId ?? null,
        player_id_list: s.playerIdList,
        primary_goalkeeper_count: s.primaryGoalkeeperCount,
        secondary_goalkeeper_count: s.secondaryGoalkeeperCount,
        any_goalkeeper_count: s.anyGoalkeeperCount,
      })),
      matches: input.matches.map((m) => ({
        id: m.id,
        starts_at: m.startsAt ?? null,
        ends_at: m.endsAt ?? null,
        is_cancelled: m.isCancelled,
        squad_id: m.squadId ?? null,
        opponent_name: m.opponentName ?? null,
      })),
      history: {
        player_match_count_map: input.history.playerMatchCountMap,
        player_role_map: input.history.playerRoleMap,
        player_recent_support_count: input.history.playerRecentSupportCount,
      },
      constraints: {
        max_squad_size: input.constraints.maxSquadSize ?? null,
        min_squad_size: input.constraints.minSquadSize ?? null,
        target_squad_size: input.constraints.targetSquadSize ?? null,
        require_goalkeeper: input.constraints.requireGoalkeeper ?? null,
        allowed_positions: input.constraints.allowedPositions ?? null,
        blocked_player_ids: input.constraints.blockedPlayerIds ?? null,
      },
    };
  }
}

export function isRegoEnabled(): boolean {
  return readRegoEnabled();
}

export function getRegoFailureMode(): string {
  return readRegoFailureMode();
}