import type { SelectionPolicyInput, SelectionPolicyResult, PolicyPack } from "./types";
import { evaluatePolicyPack } from "./json-policy-dsl";
import { evaluateDefaultMatchboardPolicy } from "./default-matchboard-policy";
import { checkCoreInvariants } from "./core-invariants";

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

export class JsonPolicyAdapter implements SelectionPolicyAdapter {
  id: string;
  name: string;
  private pack: PolicyPack;

  constructor(pack: PolicyPack) {
    this.id = pack.id;
    this.name = pack.name;
    this.pack = pack;
  }

  async evaluate(input: SelectionPolicyInput): Promise<SelectionPolicyResult> {
    return evaluatePolicyPack(this.pack, input);
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

export function createPolicyPipeline(
  customPack?: PolicyPack | null,
): SelectionPolicyAdapter {
  const defaultAdapter = new DefaultMatchboardPolicyAdapter();

  if (!customPack) {
    return defaultAdapter;
  }

  const jsonAdapter = new JsonPolicyAdapter(customPack);
  return new CompositePolicyAdapter([defaultAdapter, jsonAdapter]);
}