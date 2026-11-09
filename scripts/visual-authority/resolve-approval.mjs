// Visual Authority Gate (ADR-0159 follow-up) — scenario-scoped approval resolver. Pure,
// synchronous, no network/filesystem access — the same contract as evaluate-gate.mjs, generalized
// to per-scenario so it can be reused by both the live PR gate and read-only governance reporting
// (status-report.mjs), against an open OR a merged PR, without any separate behavior.
//
// There is still no separate "approval record" storage: everything here is re-derived fresh from
// the PR's own comment thread every time it's called. The one addition over evaluate-gate.mjs's
// PR-level model is scope: a command can address every scenario the PR's diff actually touches
// (unscoped), or a named subset (`scenarios: B01, B04`) — and each scenario's decision timeline is
// evaluated independently, so a reject of one scenario never touches another's approval.
//
// A committed manifest `approval` block (candidate.approval, pre-dating this mechanism) is honored
// as a LEGACY_MANIFEST source, but only when no PR comment addresses that scenario at all — a real
// comment-derived decision (approve OR reject) always supersedes it, never the other way around.

import { parseCommand } from "./parse-comment.mjs";

/**
 * @typedef {{
 *   scenarioId: string,
 *   componentOwners: string[],
 *   legacyApproval: { revisionSha: string, approvedBy: string, approvedAt: string } | null,
 * }} ScenarioInput
 *
 * @typedef {{
 *   scenarioId: string,
 *   state: "APPROVED" | "AWAITING_APPROVAL" | "REJECTED" | "STALE",
 *   source: "PR_COMMENT" | "LEGACY_MANIFEST" | null,
 *   approvedBy: string | null,
 *   approvedAt: string | null,
 *   approvedRevision: string | null,
 *   reason: string,
 * }} EffectiveVisualApproval
 */

function intersects(a, b) {
  const set = new Set(b);
  return a.some((item) => set.has(item));
}

/** Which scenario IDs an unscoped command applies to: every scenario whose componentOwners
 * intersects the PR's changed files, or — if none do — every scenario in scope at all. The
 * fallback is deliberately the WIDER set, not the empty set: a changed file this PR touches that
 * no scenario currently declares ownership of (e.g. the shared capture script itself) must not
 * silently exempt every scenario from needing approval. */
function unscopedScenarioIds(scenarios, changedFiles) {
  const matched = scenarios.filter((s) => intersects(s.componentOwners, changedFiles));
  return (matched.length > 0 ? matched : scenarios).map((s) => s.scenarioId);
}

/**
 * @param {object} args
 * @param {ScenarioInput[]} args.scenarios
 * @param {string[]} args.changedFiles
 * @param {Array<{body: string, user: string, createdAt: string, id: number}>} args.comments
 * @param {(login: string) => boolean} args.isPrivileged
 * @param {(login: string) => boolean} args.isVisualAuthority
 * @param {(scenarioId: string) => string} args.currentFingerprintForScenario
 * @param {(scenarioId: string, sha: string) => string | null} args.fingerprintAtShaForScenario
 * @param {string} args.currentSha
 * @returns {{ scenarios: Map<string, EffectiveVisualApproval>, errors: string[] }}
 */
export function resolveApproval({
  scenarios,
  changedFiles,
  comments,
  isPrivileged,
  isVisualAuthority,
  currentFingerprintForScenario,
  fingerprintAtShaForScenario,
  currentSha,
}) {
  const knownIds = new Set(scenarios.map((s) => s.scenarioId));
  const errors = [];

  /** @type {Map<string, Array<{kind: "approve"|"reject", sha: string, reason: string|null, user: string, createdAt: string}>>} */
  const timelineByScenario = new Map();
  for (const id of knownIds) timelineByScenario.set(id, []);

  for (const comment of comments) {
    if (!isPrivileged(comment.user) || !isVisualAuthority(comment.user)) continue;
    const parsed = parseCommand(comment.body);
    if (parsed.kind !== "approve" && parsed.kind !== "reject") continue;

    let scope;
    if (parsed.scenarios) {
      const unknown = parsed.scenarios.filter((id) => !knownIds.has(id));
      if (unknown.length > 0) {
        errors.push(`Comment from @${comment.user} references unknown scenario ID(s): ${unknown.join(", ")}`);
        continue;
      }
      scope = parsed.scenarios;
    } else {
      scope = unscopedScenarioIds(scenarios, changedFiles);
    }

    for (const scenarioId of scope) {
      timelineByScenario.get(scenarioId).push({
        kind: parsed.kind,
        sha: parsed.sha,
        reason: parsed.kind === "reject" ? parsed.reason : null,
        user: comment.user,
        createdAt: comment.createdAt,
      });
    }
  }

  /** @type {Map<string, EffectiveVisualApproval>} */
  const results = new Map();

  for (const scenario of scenarios) {
    const timeline = timelineByScenario.get(scenario.scenarioId);

    if (timeline.length === 0) {
      results.set(scenario.scenarioId, resolveLegacyOrAwaiting(scenario, currentFingerprintForScenario, fingerprintAtShaForScenario));
      continue;
    }

    const last = timeline[timeline.length - 1];

    if (last.kind === "reject") {
      results.set(scenario.scenarioId, {
        scenarioId: scenario.scenarioId,
        state: "REJECTED",
        source: "PR_COMMENT",
        approvedBy: null,
        approvedAt: null,
        approvedRevision: null,
        reason: last.reason ? `Rejected by @${last.user}: ${last.reason}` : `Rejected by @${last.user} (no reason given).`,
      });
      continue;
    }

    results.set(
      scenario.scenarioId,
      resolveApproveCommand(scenario, last, currentSha, currentFingerprintForScenario, fingerprintAtShaForScenario),
    );
  }

  return { scenarios: results, errors };
}

function resolveApproveCommand(scenario, last, currentSha, currentFingerprintForScenario, fingerprintAtShaForScenario) {
  if (last.sha === currentSha) {
    return {
      scenarioId: scenario.scenarioId,
      state: "APPROVED",
      source: "PR_COMMENT",
      approvedBy: last.user,
      approvedAt: last.createdAt,
      approvedRevision: last.sha,
      reason: `Approved by @${last.user} for the exact current revision (${currentSha}).`,
    };
  }

  const approvedFingerprint = fingerprintAtShaForScenario(scenario.scenarioId, last.sha);
  const currentFingerprint = currentFingerprintForScenario(scenario.scenarioId);
  if (approvedFingerprint !== null && approvedFingerprint === currentFingerprint) {
    return {
      scenarioId: scenario.scenarioId,
      state: "APPROVED",
      source: "PR_COMMENT",
      approvedBy: last.user,
      approvedAt: last.createdAt,
      approvedRevision: last.sha,
      reason: `Approved by @${last.user} for ${last.sha}; current revision has an identical visual-content fingerprint for this scenario.`,
    };
  }

  return {
    scenarioId: scenario.scenarioId,
    state: "STALE",
    source: "PR_COMMENT",
    approvedBy: last.user,
    approvedAt: last.createdAt,
    approvedRevision: last.sha,
    reason: `@${last.user} approved ${last.sha}, but the current revision has a different visual-content fingerprint for this scenario. A fresh approval is required.`,
  };
}

function resolveLegacyOrAwaiting(scenario, currentFingerprintForScenario, fingerprintAtShaForScenario) {
  if (!scenario.legacyApproval) {
    return {
      scenarioId: scenario.scenarioId,
      state: "AWAITING_APPROVAL",
      source: null,
      approvedBy: null,
      approvedAt: null,
      approvedRevision: null,
      reason: "No approval comment or committed approval record found for this scenario.",
    };
  }

  const { revisionSha, approvedBy, approvedAt } = scenario.legacyApproval;
  const approvedFingerprint = fingerprintAtShaForScenario(scenario.scenarioId, revisionSha);
  const currentFingerprint = currentFingerprintForScenario(scenario.scenarioId);

  if (approvedFingerprint !== null && approvedFingerprint === currentFingerprint) {
    return {
      scenarioId: scenario.scenarioId,
      state: "APPROVED",
      source: "LEGACY_MANIFEST",
      approvedBy,
      approvedAt,
      approvedRevision: revisionSha,
      reason: `Historical manifest approval by ${approvedBy} at ${revisionSha} still matches the current visual-content fingerprint for this scenario.`,
    };
  }

  return {
    scenarioId: scenario.scenarioId,
    state: "STALE",
    source: "LEGACY_MANIFEST",
    approvedBy,
    approvedAt,
    approvedRevision: revisionSha,
    reason: `Historical manifest approval by ${approvedBy} at ${revisionSha} no longer matches the current visual-content fingerprint for this scenario — a fresh \`/visual-approve\` is required.`,
  };
}
