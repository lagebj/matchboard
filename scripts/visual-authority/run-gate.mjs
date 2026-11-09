#!/usr/bin/env node
// Visual Authority Gate (ADR-0159, scenario-scoped follow-up) — orchestration for
// .github/workflows/visual-authority-gate.yml's `gate` job. Gathers everything from the GitHub
// API (paginated changed files, all PR comments, each distinct commenter's current permission, the
// PR's own commit history and merge-commit SHA, the bounded candidate-manifest registry under
// docs/ui-lab/**, and fingerprints scoped to each scenario's own componentOwners), calls the pure
// resolveApproval()/evaluateGateFromScenarios() decision core once, then posts the result as a
// GitHub check run against the exact PR head SHA. Never reports before the full evaluation
// completes. Works identically whether the PR is open or already merged — nothing here depends on
// PR state, only on its (still-resolvable) head SHA, commit history, and comment thread.
//
// Required env: GH_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER, HEAD_SHA

import { classify } from "./classify.mjs";
import { computeFingerprint } from "./fingerprint.mjs";
import { hasWriteAccess } from "./check-actor-permission.mjs";
import { loadVisualAuthorityConfig, isConfiguredApprover } from "./visual-authority-config.mjs";
import { isKnownRevision } from "./revision.mjs";
import { resolveApproval } from "./resolve-approval.mjs";
import { evaluateGateFromScenarios } from "./evaluate-gate.mjs";
import { parseCommand } from "./parse-comment.mjs";

const token = requireEnv("GH_TOKEN");
const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
const prNumber = requireEnv("PR_NUMBER");
const headSha = requireEnv("HEAD_SHA");
// Optional — only set for issue_comment-triggered runs (including on an already-merged PR). Used
// solely to decide whether to post an informational acknowledgment reply; never affects the
// Checks-API conclusion itself, which is always recomputed from the full comment thread above.
const eventName = process.env.EVENT_NAME ?? null;
const triggeringCommentBody = process.env.COMMENT_BODY ?? null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function ghFetch(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "matchboard-visual-authority-gate",
      ...(init.headers ?? {}),
    },
  });
  return response;
}

async function paginate(path) {
  const results = [];
  let page = 1;
  let complete = true;
  for (;;) {
    const response = await ghFetch(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!response.ok) {
      complete = false;
      break;
    }
    const json = await response.json();
    if (!Array.isArray(json) || json.length === 0) break;
    results.push(...json);
    if (json.length < 100) break;
    page += 1;
  }
  return { results, complete };
}

async function getChangedFiles() {
  const { results, complete } = await paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);
  return { files: results.map((f) => f.filename), complete };
}

async function getComments() {
  const { results, complete } = await paginate(`/repos/${owner}/${repo}/issues/${prNumber}/comments`);
  return {
    comments: results.map((c) => ({ body: c.body ?? "", user: c.user?.login ?? "", createdAt: c.created_at, id: c.id })),
    complete,
  };
}

async function getPrMeta() {
  const response = await ghFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  if (!response.ok) return { mergeCommitSha: null, merged: false, complete: false };
  const json = await response.json();
  return { mergeCommitSha: json.merge_commit_sha ?? null, merged: json.merged === true, complete: true };
}

async function postAcknowledgmentReply(result) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body:
        `Visual Authority Gate re-evaluated this already-merged PR: **${result.state}**. ${result.summary}\n\n` +
        "This is an automated acknowledgment, not an approval — only a human-posted `/visual-approve`/`/visual-reject` comment changes the effective decision.",
    }),
  });
}

async function getPrCommitShas() {
  const { results, complete } = await paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`);
  return { shas: results.map((c) => c.sha), complete };
}

async function readFileAtRef(path, ref) {
  const response = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`);
  if (!response.ok) return null;
  const json = await response.json();
  if (json.encoding !== "base64" || typeof json.content !== "string") return null;
  return Buffer.from(json.content, "base64").toString("utf8");
}

// Bounded — this is a fixed, small registry (every docs/ui-lab/**/candidate_manifest.json), never
// proportional to this PR's own size or to repository history. Uses the Git Trees API (one call)
// rather than walking directories, and fails closed (treats the registry as unavailable, never as
// empty) if GitHub reports the tree was truncated.
async function listCandidateManifestPaths(ref) {
  const response = await ghFetch(`/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
  if (!response.ok) return { paths: [], complete: false };
  const json = await response.json();
  if (json.truncated) return { paths: [], complete: false };
  const paths = (json.tree ?? [])
    .filter((entry) => entry.type === "blob" && /^docs\/ui-lab\/.*\/candidate_manifest\.json$/.test(entry.path))
    .map((entry) => entry.path);
  return { paths, complete: true };
}

async function loadScenarioRegistry(ref) {
  const { paths, complete } = await listCandidateManifestPaths(ref);
  if (!complete) return { scenarios: [], complete: false };

  const scenarios = [];
  for (const manifestPath of paths) {
    const content = await readFileAtRef(manifestPath, ref);
    if (!content) continue;
    let manifest;
    try {
      manifest = JSON.parse(content);
    } catch {
      continue;
    }
    for (const candidate of manifest.candidates ?? []) {
      if (!candidate.scenarioId) continue;
      scenarios.push({
        scenarioId: candidate.scenarioId,
        componentOwners: Array.isArray(candidate.componentOwners) ? candidate.componentOwners : [],
        legacyApproval:
          candidate.approval && candidate.approval.revisionSha
            ? {
                revisionSha: candidate.approval.revisionSha,
                approvedBy: candidate.approval.approvedBy ?? "unknown",
                approvedAt: candidate.approval.approvedAt ?? null,
              }
            : null,
      });
    }
  }
  return { scenarios, complete: true };
}

async function fingerprintForScenarioAtRef(scenario, ref) {
  const reader = new Map();
  for (const path of scenario.componentOwners) {
    reader.set(path, await readFileAtRef(path, ref));
  }
  return computeFingerprint(scenario.componentOwners, (p) => reader.get(p) ?? null);
}

async function postCheckRun({ conclusion, title, summary }) {
  const response = await ghFetch(`/repos/${owner}/${repo}/check-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Visual Authority Gate",
      head_sha: headSha,
      status: "completed",
      conclusion,
      output: { title, summary },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to post check run: ${response.status} ${text}`);
  }
}

function approveShasReferencedIn(comments) {
  const shas = new Set();
  for (const comment of comments) {
    const match = comment.body.match(/^\/visual-approve\s+([0-9a-f]{7,40})/im);
    if (match) shas.add(match[1].toLowerCase());
  }
  return shas;
}

async function main() {
  const { files, complete: filesComplete } = await getChangedFiles();
  const classification = classify(files, { incomplete: !filesComplete });

  if (!classification.applicable) {
    const result = evaluateGateFromScenarios({ applicable: false, scenarioResults: new Map(), errors: [] });
    await postCheckRun(result);
    console.log(`${result.state}: ${result.summary}`);
    return;
  }

  const { comments, complete: commentsComplete } = await getComments();
  if (!commentsComplete) {
    await postCheckRun({
      conclusion: "failure",
      title: "Could not retrieve complete comment history",
      summary: "Pagination of this PR's comments did not complete — failing closed rather than evaluating against a partial history.",
    });
    console.log("INVALID: comment pagination incomplete, failed closed");
    return;
  }

  const { scenarios, complete: registryComplete } = await loadScenarioRegistry(headSha);
  if (!registryComplete) {
    await postCheckRun({
      conclusion: "failure",
      title: "Could not retrieve the candidate scenario registry",
      summary: "Listing docs/ui-lab/**/candidate_manifest.json at the PR head did not complete (or the tree was truncated) — failing closed rather than evaluating against a partial registry.",
    });
    console.log("INVALID: scenario registry incomplete, failed closed");
    return;
  }

  const distinctActors = [...new Set(comments.map((c) => c.user).filter(Boolean))];
  const privilegeByActor = new Map();
  for (const actor of distinctActors) {
    privilegeByActor.set(actor, await hasWriteAccess({ owner, repo, actor, token }));
  }
  const visualAuthorityConfig = loadVisualAuthorityConfig();

  const [{ mergeCommitSha, merged }, { shas: prCommitShas }] = await Promise.all([getPrMeta(), getPrCommitShas()]);

  const currentFingerprints = new Map();
  for (const scenario of scenarios) {
    currentFingerprints.set(scenario.scenarioId, await fingerprintForScenarioAtRef(scenario, headSha));
  }

  const referencedShas = approveShasReferencedIn(comments);
  const fingerprintAtShaCache = new Map();
  for (const scenario of scenarios) {
    for (const sha of referencedShas) {
      if (sha === headSha.toLowerCase()) continue;
      const key = `${scenario.scenarioId}::${sha}`;
      if (!isKnownRevision({ sha, headSha, prCommitShas, mergeCommitSha })) {
        fingerprintAtShaCache.set(key, null);
        continue;
      }
      try {
        fingerprintAtShaCache.set(key, await fingerprintForScenarioAtRef(scenario, sha));
      } catch {
        fingerprintAtShaCache.set(key, null);
      }
    }
    if (scenario.legacyApproval) {
      const key = `${scenario.scenarioId}::${scenario.legacyApproval.revisionSha.toLowerCase()}`;
      if (!fingerprintAtShaCache.has(key)) {
        try {
          fingerprintAtShaCache.set(key, await fingerprintForScenarioAtRef(scenario, scenario.legacyApproval.revisionSha));
        } catch {
          fingerprintAtShaCache.set(key, null);
        }
      }
    }
  }

  const { scenarios: scenarioResults, errors } = resolveApproval({
    scenarios,
    changedFiles: files,
    comments,
    isPrivileged: (login) => privilegeByActor.get(login) === true,
    isVisualAuthority: (login) => isConfiguredApprover(login, visualAuthorityConfig),
    currentFingerprintForScenario: (scenarioId) => currentFingerprints.get(scenarioId) ?? "",
    fingerprintAtShaForScenario: (scenarioId, sha) =>
      fingerprintAtShaCache.get(`${scenarioId}::${sha.toLowerCase()}`) ??
      (sha.toLowerCase() === headSha.toLowerCase() ? currentFingerprints.get(scenarioId) ?? "" : null),
    currentSha: headSha,
  });

  const result = evaluateGateFromScenarios({ applicable: true, scenarioResults, errors });

  await postCheckRun(result);
  console.log(`${result.state}: ${result.summary}`);

  // Merged PRs no longer have a merge-blocking check to update visibly, so acknowledge a real
  // approve/reject command with a reply — never the approval/rejection itself, only a receipt
  // confirming the comment-ledger decision was recognized (ADR-0159's "Self-approval" boundary:
  // automation may acknowledge, never originate, an approval).
  if (merged && eventName === "issue_comment" && triggeringCommentBody) {
    const triggeringCommand = parseCommand(triggeringCommentBody);
    if (triggeringCommand.kind === "approve" || triggeringCommand.kind === "reject") {
      await postAcknowledgmentReply(result);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
