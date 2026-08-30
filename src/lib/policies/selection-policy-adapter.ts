import type { SelectionPolicyInput, SelectionPolicyResult } from "./types";
import { evaluateDefaultMatchboardPolicy } from "./default-matchboard-policy";
import { checkCoreInvariants } from "./core-invariants";
import { RegoPolicyAdapter } from "./rego-policy-adapter";

export interface SelectionPolicyAdapter {
  id: string;
  name: string;
  evaluate(input: SelectionPolicyInput): Promise<SelectionPolicyResult>;
}

export class DefaultMatchboardPolicyAdapter implements SelectionPolicyAdapter {
  id = "default-matchboard";
  name = "Default Matchboard Policy";

  async evaluate(input: SelectionPolicyInput): Promise<SelectionPolicyResult> {
    return evaluateDefaultMatchboardPolicy(input);
  }
}

export class CompositePolicyAdapter implements SelectionPolicyAdapter {
  id = "composite";
  name = "Composite Policy";
  private adapters: SelectionPolicyAdapter[];

  constructor(adapters: SelectionPolicyAdapter[]) {
    this.adapters = adapters;
  }

  async evaluate(input: SelectionPolicyInput): Promise<SelectionPolicyResult> {
    const coreViolations = checkCoreInvariants(input);
    const coreBlocked: Record<string, string[]> = {};
    for (const v of coreViolations) {
      if (!coreBlocked[v.playerId]) coreBlocked[v.playerId] = [];
      coreBlocked[v.playerId].push(v.rule);
    }

    const allWarnings: SelectionPolicyResult["warnings"] = [];
    const allScoreAdjustments: SelectionPolicyResult["scoreAdjustments"] = [];
    const allExplanations: SelectionPolicyResult["explanations"] = [];
    const allTags: SelectionPolicyResult["tags"] = [];

    const policyBlocked: Record<string, string[]> = {};

    for (const adapter of this.adapters) {
      const result = await adapter.evaluate(input);

      for (const [playerId, reasons] of Object.entries(result.blocked)) {
        if (!policyBlocked[playerId]) policyBlocked[playerId] = [];
        for (const reason of reasons) {
          if (!policyBlocked[playerId].includes(reason)) {
            policyBlocked[playerId].push(reason);
          }
        }
      }

      allWarnings.push(...result.warnings);
      allScoreAdjustments.push(...result.scoreAdjustments);
      allExplanations.push(...result.explanations);
      allTags.push(...result.tags);
    }

    const mergedBlocked: Record<string, string[]> = { ...coreBlocked };
    for (const [playerId, reasons] of Object.entries(policyBlocked)) {
      if (!mergedBlocked[playerId]) mergedBlocked[playerId] = [];
      for (const reason of reasons) {
        if (!mergedBlocked[playerId].includes(reason)) {
          mergedBlocked[playerId].push(reason);
        }
      }
    }

    const allBlockedIds = new Set(Object.keys(mergedBlocked));
    const allowedPlayerIds = input.players
      .filter((p) => !allBlockedIds.has(p.id))
      .map((p) => p.id);

    return {
      allowedPlayerIds,
      blocked: mergedBlocked,
      warnings: allWarnings,
      scoreAdjustments: allScoreAdjustments,
      explanations: allExplanations,
      tags: allTags,
    };
  }
}

/**
 * The Rego-backed selection adapter always runs — OPA/Rego is a standard Matchboard runtime
 * capability, not an opt-in gated by an environment variable (ADR-0107). The built-in pack
 * degrades safely to an empty result on unexpected runtime failure rather than being toggled
 * off; see `RegoPolicyAdapter`/`policy-runtime.ts`.
 */
export function createPolicyPipeline(): SelectionPolicyAdapter {
  const defaultAdapter = new DefaultMatchboardPolicyAdapter();
  const regoAdapter = new RegoPolicyAdapter();
  return new CompositePolicyAdapter([defaultAdapter, regoAdapter]);
}