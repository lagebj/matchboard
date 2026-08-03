"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

type PolicyDecisionType =
  | "league_match_selection"
  | "league_round_fairness"
  | "event_squad_generation"
  | "event_helper_selection"
  | "event_lineup_planning"
  | "post_match_report_availability";

type PolicyMode = "league" | "event";

type FixtureSummary = {
  id: string;
  label: string;
  description: string;
  decisionType: PolicyDecisionType;
  mode: PolicyMode;
};

type WorkbenchDiagnostics = {
  regoEnabled: boolean;
  regoWasmLoaded: boolean;
  policyVersion: string;
  artifactHash: string | null;
  failureMode: string;
  evaluationTimestamp: string;
};

type WorkbenchInputSummary = {
  playerCount: number;
  teamCount: number;
  squadCount: number;
  matchCount: number;
  availablePlayerCount: number;
  blockedPlayerCount: number;
  contextMode: PolicyMode;
  decisionType: PolicyDecisionType;
  fairnessScope?: string;
  generationMode?: string;
};

type WorkbenchPolicyRun = {
  source: "default_only" | "rego_enabled";
  result: {
    allowedPlayerIds: string[];
    blocked: Record<string, string[]>;
    warnings: { code: string; severity: string; message: string; playerId?: string; source?: string }[];
    scoreAdjustments: { playerId: string; delta: number; reason: string; code: string; source?: string }[];
    explanations: { playerId: string; code: string; summary: string; hardRule?: boolean; source?: string }[];
    tags: { playerId: string; tag: string; reason: string; source?: string }[];
  };
  evaluationDurationMs: number;
  regoEnabled: boolean;
  regoFailureMode: string;
  policyVersion: string;
  artifactHash: string | null;
};

type PolicyDiff = {
  blockedAddedByRego: Record<string, string[]>;
  warningsAddedByRego: { code: string; severity: string; message: string; playerId?: string }[];
  scoreAdjustmentsAddedByRego: { playerId: string; delta: number; reason: string; code: string }[];
  explanationsAddedByRego: { playerId: string; code: string; summary: string }[];
  validityChanged: boolean;
  wasValidDefaultOnly: boolean;
  isValidWithRego: boolean;
};

type WorkbenchRunResult = {
  context: {
    mode: PolicyMode;
    decisionType: PolicyDecisionType;
    fairnessScope?: string;
    generationMode?: string;
    nowIso: string;
    gameFormat?: string | null;
  };
  inputSummary: WorkbenchInputSummary;
  policy: {
    defaultOnly?: WorkbenchPolicyRun;
    withRego?: WorkbenchPolicyRun;
    diff?: PolicyDiff;
  };
  diagnostics: WorkbenchDiagnostics;
};

const DECISION_TYPE_LABELS: Record<PolicyDecisionType, string> = {
  league_match_selection: "League match selection",
  league_round_fairness: "League round fairness",
  event_squad_generation: "Event squad generation",
  event_helper_selection: "Event helper selection",
  event_lineup_planning: "Event lineup planning",
  post_match_report_availability: "Post-match report availability",
};

const SOURCE_LABELS: Record<string, string> = {
  core: "Core invariant",
  default_policy: "Default policy",
  rego: "Rego policy",
  solver: "Solver",
  validation: "Validation",
};

export function WorkbenchPageContent() {
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string>("");
  const [compareRego, setCompareRego] = useState(false);
  const [diagnostics, setDiagnostics] = useState<WorkbenchDiagnostics | null>(null);
  const [result, setResult] = useState<WorkbenchRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workbench/fixtures")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFixtures(data);
      })
      .catch(() => {});
    fetch("/api/workbench/diagnostics")
      .then((r) => r.json())
      .then((data) => setDiagnostics(data))
      .catch(() => {});
  }, []);

  async function handleRun() {
    if (!selectedFixture) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/workbench/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "fixture",
          fixtureId: selectedFixture,
          compareRego,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || `HTTP ${res.status}`);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const selectedFixtureData = fixtures.find((f) => f.id === selectedFixture);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Policy and Generation Workbench"
        description="Dry-run policy and generation behavior without changing event, league, lineup, or report data."
      />
      <p className="text-xs text-[var(--text-muted)] border border-[var(--border-subtle)] rounded px-2 py-1 bg-[var(--surface-muted)]">
        Currently available to all logged-in users. Intended to move behind an admin permission when admin roles exist.
        {" "}
        <a href="/simulation" className="text-[var(--accent)] hover:underline">Season Planning Simulation →</a>
      </p>

      {diagnostics && (
        <Surface variant="default" padding="md">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">Runtime Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Policy version</span>
              <p className="font-mono">{diagnostics.policyVersion}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Rego enabled</span>
              <p>{diagnostics.regoEnabled ? "Yes" : "No"}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Artifact hash</span>
              <p className="font-mono text-xs">{diagnostics.artifactHash ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Failure mode</span>
              <p>{diagnostics.failureMode}</p>
            </div>
          </div>
        </Surface>
      )}

      <Surface variant="default" padding="md">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-[var(--text-muted)]">Fixture</label>
            <select
              className="mt-1 w-full h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-sm text-zinc-100"
              value={selectedFixture}
              onChange={(e) => setSelectedFixture(e.target.value)}
            >
              <option value="">Select a fixture...</option>
              {fixtures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={compareRego}
                onChange={(e) => setCompareRego(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              Compare default vs Rego
            </label>
          </div>
          <div className="flex items-end">
            <Button onClick={handleRun} disabled={!selectedFixture || loading}>
              {loading ? "Running..." : "Run dry-run"}
            </Button>
          </div>
        </div>
        {selectedFixtureData && (
          <p className="text-xs text-[var(--text-muted)] mt-2">{selectedFixtureData.description}</p>
        )}
      </Surface>

      {error && (
        <Surface variant="danger" padding="md">
          <p className="text-sm">{error}</p>
        </Surface>
      )}

      {result && (
        <>
          <Surface variant="default" padding="md">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">Input Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-[var(--text-muted)]">Mode</span><p className="font-medium">{result.inputSummary.contextMode}</p></div>
              <div><span className="text-[var(--text-muted)]">Decision type</span><p className="font-medium">{DECISION_TYPE_LABELS[result.inputSummary.decisionType] ?? result.inputSummary.decisionType}</p></div>
              <div><span className="text-[var(--text-muted)]">Players</span><p>{result.inputSummary.playerCount} total, {result.inputSummary.availablePlayerCount} available</p></div>
              <div><span className="text-[var(--text-muted)]">Squads</span><p>{result.inputSummary.squadCount}</p></div>
            </div>
          </Surface>

          {result.policy.defaultOnly && (
            <PolicyRunPanel title="Default Policy (Core + TypeScript)" run={result.policy.defaultOnly} />
          )}

          {result.policy.withRego && (
            <PolicyRunPanel title="With Rego Policy" run={result.policy.withRego} />
          )}

          {result.policy.diff && <DiffPanel diff={result.policy.diff} />}

          <Surface variant="subtle" padding="md">
            <p className="text-xs text-[var(--text-muted)]">
              Evaluation completed at {result.diagnostics.evaluationTimestamp}
              {" — Duration: "}{result.policy.defaultOnly?.evaluationDurationMs ?? "N/A"}ms (default)
              {result.policy.withRego ? `, ${result.policy.withRego.evaluationDurationMs}ms (with Rego)` : ""}
            </p>
          </Surface>

          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Raw JSON (sanitized)
            </summary>
            <pre className="mt-2 p-3 bg-[var(--surface-muted)] rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(
                {
                  context: result.context,
                  inputSummary: result.inputSummary,
                  policy: {
                    defaultOnly: result.policy.defaultOnly
                      ? {
                          blocked: result.policy.defaultOnly.result.blocked,
                          warningCount: result.policy.defaultOnly.result.warnings.length,
                          scoreAdjustmentCount: result.policy.defaultOnly.result.scoreAdjustments.length,
                          explanationCount: result.policy.defaultOnly.result.explanations.length,
                          evaluationDurationMs: result.policy.defaultOnly.evaluationDurationMs,
                        }
                      : undefined,
                  },
                  diagnostics: result.diagnostics,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function PolicyRunPanel({ title, run }: { title: string; run: WorkbenchPolicyRun }) {
  const { result } = run;
  const blockedCount = Object.keys(result.blocked).length;
  const blockingWarnings = result.warnings.filter((w) => w.severity === "blocking");
  const otherWarnings = result.warnings.filter((w) => w.severity !== "blocking");

  return (
    <Surface variant="default" padding="md">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <span className="text-xs text-[var(--text-muted)]">
          {run.evaluationDurationMs}ms | v{run.policyVersion}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-4">
        <div><span className="text-[var(--text-muted)]">Blocked</span><p className="font-bold text-[var(--danger)]">{blockedCount}</p></div>
        <div><span className="text-[var(--text-muted)]">Blocking</span><p className="font-bold text-[var(--danger)]">{blockingWarnings.length}</p></div>
        <div><span className="text-[var(--text-muted)]">Warnings</span><p className="font-bold text-[var(--warning)]">{otherWarnings.length}</p></div>
        <div><span className="text-[var(--text-muted)]">Score adj.</span><p className="font-bold">{result.scoreAdjustments.length}</p></div>
        <div><span className="text-[var(--text-muted)]">Explanations</span><p className="font-bold">{result.explanations.length}</p></div>
      </div>

      {blockedCount > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-1">Blocked Players</h4>
          <div className="space-y-1">
            {Object.entries(result.blocked).map(([playerId, reasons]) => (
              <div key={playerId} className="flex items-start gap-2 text-sm">
                <span className="font-mono text-xs bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">{playerId}</span>
                <span className="text-[var(--text-muted)]">{reasons.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-1">Warnings</h4>
          <div className="space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  w.severity === "blocking" ? "bg-[var(--danger-subtle)] text-[var(--danger)]" :
                  w.severity === "warning" ? "bg-[var(--warning-subtle)] text-[var(--warning)]" :
                  "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                }`}>{w.severity}</span>
                {w.source && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-muted)]">{SOURCE_LABELS[w.source] ?? w.source}</span>}
                <span>{w.message}</span>
                {w.playerId && <span className="text-[var(--text-muted)]">({w.playerId})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.scoreAdjustments.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-1">Score Adjustments</h4>
          <div className="space-y-1">
            {result.scoreAdjustments.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`font-mono ${a.delta > 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>{a.delta > 0 ? "+" : ""}{a.delta}</span>
                {a.source && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-muted)]">{SOURCE_LABELS[a.source] ?? a.source}</span>}
                <span>{a.reason}</span>
                <span className="text-[var(--text-muted)]">({a.playerId})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.explanations.length > 0 && result.explanations.length <= 20 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Explanations</h4>
          <div className="space-y-1">
            {result.explanations.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {e.source && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-muted)]">{SOURCE_LABELS[e.source] ?? e.source}</span>}
                <span>{e.summary}</span>
                <span className="text-[var(--text-muted)]">({e.playerId})</span>
                {e.hardRule && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--danger-subtle)] text-[var(--danger)]">hard rule</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Surface>
  );
}

function DiffPanel({ diff }: { diff: PolicyDiff }) {
  const hasChanges =
    Object.keys(diff.blockedAddedByRego).length > 0 ||
    diff.warningsAddedByRego.length > 0 ||
    diff.scoreAdjustmentsAddedByRego.length > 0 ||
    diff.explanationsAddedByRego.length > 0 ||
    diff.validityChanged;

  return (
    <Surface variant={hasChanges ? "warning" : "success"} padding="md">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">
        Diff: Default vs Rego
        {!hasChanges && <span className="ml-2 text-xs text-[var(--accent)]">No changes from Rego</span>}
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-[var(--text-muted)]">Valid (default only)</span>
          <p>{diff.wasValidDefaultOnly ? "Yes" : "No"}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Valid (with Rego)</span>
          <p>{diff.isValidWithRego ? "Yes" : "No"}</p>
        </div>
      </div>

      {Object.keys(diff.blockedAddedByRego).length > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-[var(--danger)]">Players blocked by Rego</h4>
          {Object.entries(diff.blockedAddedByRego).map(([playerId, reasons]) => (
            <div key={playerId} className="ml-2 text-sm text-[var(--text-muted)]">
              <span className="font-mono text-xs bg-[var(--surface-muted)] px-1.5 py-0.5 rounded">{playerId}</span>: {reasons.join(", ")}
            </div>
          ))}
        </div>
      )}

      {diff.warningsAddedByRego.length > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-[var(--warning)]">Warnings added by Rego</h4>
          {diff.warningsAddedByRego.map((w, i) => (
            <div key={i} className="ml-2 text-sm text-[var(--text-muted)]">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                w.severity === "blocking" ? "bg-[var(--danger-subtle)] text-[var(--danger)]" :
                w.severity === "warning" ? "bg-[var(--warning-subtle)] text-[var(--warning)]" :
                "bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}>{w.severity}</span> {w.message}
              {w.playerId && <span> ({w.playerId})</span>}
            </div>
          ))}
        </div>
      )}

      {diff.scoreAdjustmentsAddedByRego.length > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-[var(--warning)]">Score adjustments added by Rego</h4>
          {diff.scoreAdjustmentsAddedByRego.map((a, i) => (
            <div key={i} className="ml-2 text-sm text-[var(--text-muted)]">
              <span className={`font-mono ${a.delta > 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                {a.delta > 0 ? "+" : ""}{a.delta}
              </span> {a.reason} ({a.playerId})
            </div>
          ))}
        </div>
      )}

      {diff.explanationsAddedByRego.length > 0 && (
        <div className="mb-3">
          <h4 className="font-medium text-[var(--warning)]">Explanations added by Rego</h4>
          {diff.explanationsAddedByRego.map((e, i) => (
            <div key={i} className="ml-2 text-sm text-[var(--text-muted)]">
              {e.summary} ({e.playerId})
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}