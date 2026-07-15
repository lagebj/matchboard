import type {
  PolicyDecisionType,
  PolicyMode,
  PolicyFairnessScope,
  SelectionPolicyInput,
  SelectionPolicyResult,
} from "@/lib/policies/types";

export type WorkbenchSource = "fixture" | "app_data";

export type WorkbenchRunRequest = {
  source: WorkbenchSource;
  fixtureId?: string;
  contextOverride?: Partial<SelectionPolicyInput["context"]>;
  compareRego?: boolean;
  runGeneration?: boolean;
};

export type WorkbenchPolicyRun = {
  source: "default_only" | "rego_enabled";
  result: SelectionPolicyResult;
  evaluationDurationMs: number;
  regoEnabled: boolean;
  regoFailureMode: string;
  policyVersion: string;
  artifactHash: string | null;
};

export type WorkbenchPolicyDiff = {
  blockedAddedByRego: Record<string, string[]>;
  warningsAddedByRego: { code: string; severity: string; message: string; playerId?: string }[];
  scoreAdjustmentsAddedByRego: { playerId: string; delta: number; reason: string; code: string }[];
  explanationsAddedByRego: { playerId: string; code: string; summary: string }[];
  validityChanged: boolean;
  wasValidDefaultOnly: boolean;
  isValidWithRego: boolean;
};

export type WorkbenchInputSummary = {
  playerCount: number;
  teamCount: number;
  squadCount: number;
  matchCount: number;
  availablePlayerCount: number;
  blockedPlayerCount: number;
  contextMode: PolicyMode;
  decisionType: PolicyDecisionType;
  fairnessScope?: PolicyFairnessScope;
  generationMode?: string;
};

export type WorkbenchGenerationSummary = {
  generated: boolean;
  squadCount?: number;
  totalPlayersAssigned?: number;
  averageRating?: number | null;
  goalkeeperCoverage?: Record<string, string>;
  positionCoverage?: Record<string, number>;
  warnings?: string[];
  blockingIssues?: string[];
  validToCommit?: boolean;
};

export type WorkbenchValidationResult = {
  valid: boolean;
  blockingIssues: string[];
  warnings: string[];
  info: string[];
};

export type WorkbenchDiagnostics = {
  regoEnabled: boolean;
  regoWasmLoaded: boolean;
  policyVersion: string;
  artifactHash: string | null;
  packId: string | null;
  packVersion: string | null;
  failureMode: string;
  evaluationTimestamp: string;
};

export type WorkbenchRunResult = {
  context: SelectionPolicyInput["context"];
  inputSummary: WorkbenchInputSummary;
  policy: {
    defaultOnly?: WorkbenchPolicyRun;
    withRego?: WorkbenchPolicyRun;
    diff?: WorkbenchPolicyDiff;
  };
  generation?: WorkbenchGenerationSummary;
  validation?: WorkbenchValidationResult;
  diagnostics: WorkbenchDiagnostics;
};

export type WorkbenchFixture = {
  id: string;
  label: string;
  description: string;
  decisionType: PolicyDecisionType;
  mode: PolicyMode;
  input: SelectionPolicyInput;
};