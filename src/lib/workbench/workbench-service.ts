import "server-only";

import type { SelectionPolicyInput } from "@/lib/policies/types";
import {
  evaluateSelectionPolicy,
  type PolicyEvaluationResult,
} from "@/lib/policies/policy-evaluation";
import {
  getPolicyVersion,
  getPolicyArtifactHash,
} from "@/lib/policies/policy-version";
import { isRegoEnabled, getRegoFailureMode, clearRegoPolicyCache } from "@/lib/policies/rego-policy-adapter";
import { getActivePackId, loadPackMetadata } from "@/lib/policies/policy-pack";
import { evaluateDefaultMatchboardPolicy } from "@/lib/policies/default-matchboard-policy";
import { diffPolicyResults, summarizeInput, type PolicyDiff } from "./policy-diff";
import type {
  WorkbenchRunRequest,
  WorkbenchRunResult,
  WorkbenchPolicyRun,
  WorkbenchDiagnostics,
  WorkbenchFixture,
} from "./workbench-types";

export async function runWorkbench(
  request: WorkbenchRunRequest,
): Promise<WorkbenchRunResult> {
  const input = await loadWorkbenchInput(request);
  const inputSummary = summarizeInput(input);
  inputSummary.blockedPlayerCount = Object.keys(
    (await runDefaultOnlyPolicy(input)).result.blocked,
  ).length;

  const defaultOnlyRun = await runDefaultOnlyPolicy(input);

  let withRegoRun: WorkbenchPolicyRun | undefined;
  let diff: PolicyDiff | undefined;

  if (request.compareRego) {
    withRegoRun = await runRegoEnabledPolicy(input);
    diff = diffPolicyResults(defaultOnlyRun.result, withRegoRun.result);
  }

  const diagnostics = getWorkbenchDiagnostics();

  return {
    context: input.context,
    inputSummary,
    policy: {
      defaultOnly: defaultOnlyRun,
      withRego: withRegoRun,
      diff,
    },
    diagnostics,
  };
}

export async function getWorkbenchFixtureList(): Promise<
  Pick<WorkbenchFixture, "id" | "label" | "description" | "decisionType" | "mode">[]
> {
  const fixtures = await loadAllFixtures();
  return fixtures.map((f) => ({
    id: f.id,
    label: f.label,
    description: f.description,
    decisionType: f.decisionType,
    mode: f.mode,
  }));
}

export async function getWorkbenchFixture(
  fixtureId: string,
): Promise<WorkbenchFixture | null> {
  const fixtures = await loadAllFixtures();
  return fixtures.find((f) => f.id === fixtureId) ?? null;
}

async function loadWorkbenchInput(
  request: WorkbenchRunRequest,
): Promise<SelectionPolicyInput> {
  if (request.source === "fixture" && request.fixtureId) {
    const fixture = await getWorkbenchFixture(request.fixtureId);
    if (!fixture) {
      throw new Error(`Workbench fixture not found: ${request.fixtureId}`);
    }
    const input: SelectionPolicyInput = {
      ...fixture.input,
      context: {
        ...fixture.input.context,
        ...request.contextOverride,
      },
    };
    return input;
  }

  throw new Error(
    `Workbench source "${request.source}" is not yet supported. Use "fixture" source.`,
  );
}

async function runDefaultOnlyPolicy(
  input: SelectionPolicyInput,
): Promise<WorkbenchPolicyRun> {
  const start = performance.now();
  const result = evaluateDefaultMatchboardPolicy(input);
  const duration = performance.now() - start;

  return {
    source: "default_only",
    result,
    evaluationDurationMs: Math.round(duration * 100) / 100,
    regoEnabled: false,
    regoFailureMode: "fail_closed",
    policyVersion: getPolicyVersion(),
    artifactHash: null,
  };
}

async function runRegoEnabledPolicy(
  input: SelectionPolicyInput,
): Promise<WorkbenchPolicyRun> {
  const start = performance.now();
  let result: PolicyEvaluationResult;

  try {
    result = await evaluateSelectionPolicy(input);
  } catch {
    clearRegoPolicyCache();
    const defaultResult = evaluateDefaultMatchboardPolicy(input);
    result = {
      result: defaultResult,
      input,
      regoEnabled: true,
      regoFailureMode: getRegoFailureMode(),
      evaluationDurationMs: 0,
    };
  }

  const duration = performance.now() - start;

  return {
    source: "rego_enabled",
    result: result.result,
    evaluationDurationMs: Math.round(duration * 100) / 100,
    regoEnabled: result.regoEnabled,
    regoFailureMode: result.regoFailureMode,
    policyVersion: getPolicyVersion(),
    artifactHash: getPolicyArtifactHash(),
  };
}

export function getWorkbenchDiagnostics(): WorkbenchDiagnostics {
  const regoEnabled = isRegoEnabled();
  const packId = regoEnabled ? getActivePackId() : null;
  const packMetadata = packId ? loadPackMetadata(packId) : null;

  return {
    regoEnabled,
    regoWasmLoaded: regoEnabled,
    policyVersion: getPolicyVersion(),
    artifactHash: getPolicyArtifactHash(),
    packId,
    packVersion: packMetadata?.version ?? null,
    failureMode: getRegoFailureMode(),
    evaluationTimestamp: new Date().toISOString(),
  };
}

async function loadAllFixtures(): Promise<WorkbenchFixture[]> {
  const fixtureModules = await Promise.all([
    import("@/../test/fixtures/workbench/event-balanced-three-squads.json"),
    import("@/../test/fixtures/workbench/event-competitive-topped-plus-balanced.json"),
    import("@/../test/fixtures/workbench/event-weak-goalkeeper-coverage.json"),
    import("@/../test/fixtures/workbench/event-pool-restricted.json"),
    import("@/../test/fixtures/workbench/event-helper-overlap.json"),
    import("@/../test/fixtures/workbench/league-match-selection.json"),
    import("@/../test/fixtures/workbench/league-round-fairness.json"),
  ]);

  return fixtureModules.map((mod, _i) => {
    const fixture = mod.default as WorkbenchFixture;
    return fixture;
  }).filter(Boolean);
}