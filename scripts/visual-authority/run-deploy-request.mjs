#!/usr/bin/env node
// Visual Authority Gate (ADR-0159) — orchestration for .github/workflows/visual-review-deploy.yml.
//
// SECURITY: this script runs checked out from the PR's BASE ref (main), never the PR's own ref —
// see visual-authority-gate.yml's identical rule. Every decision made here (permission check,
// fork check, required-checks-green check, lightweight-eligibility check, lease check) must use
// this repository's own trusted logic, never a PR-controlled version of it, or any PR could
// rewrite classify.mjs to simply declare itself eligible. Only AFTER this script approves does
// the calling workflow check out the PR's own ref — and only to run `vercel deploy`, which
// uploads source for a remote Vercel build; this GitHub runner never executes the PR's build
// itself (same pattern scripts/test-acceptance/deploy.sh already uses for the labeled
// `acceptance` path).
//
// Writes GitHub Actions step outputs describing what the calling workflow should do next:
//   decision=deploy | release | reject
//   reason=<human-readable explanation, also posted as a PR comment by this script>
//   head_sha=<only for decision=deploy>
//
// Required env: GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, COMMENT_BODY, COMMENT_ACTOR

import { appendFileSync } from "node:fs";
import { parseCommand } from "./parse-comment.mjs";
import { hasWriteAccess } from "./check-actor-permission.mjs";
import { classifyLightweightDeployEligibility } from "./classify.mjs";

const token = requireEnv("GH_TOKEN");
const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
const prNumber = requireEnv("PR_NUMBER");
const commentBody = requireEnv("COMMENT_BODY");
const actor = requireEnv("COMMENT_ACTOR");

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is required`);
  return value;
}

async function ghFetch(path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "matchboard-visual-authority-gate",
      ...(init.headers ?? {}),
    },
  });
}

async function postComment(body) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

function writeOutput(entries) {
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  appendFileSync(requireEnv("GITHUB_OUTPUT"), lines.join("\n") + "\n");
}

async function reject(reason) {
  await postComment(`\`/visual-review\` request declined: ${reason}`);
  writeOutput({ decision: "reject", reason: JSON.stringify(reason) });
}

async function paginateAll(path) {
  const results = [];
  let page = 1;
  for (;;) {
    const response = await ghFetch(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!response.ok) return { results, complete: false };
    const json = await response.json();
    if (!Array.isArray(json) || json.length === 0) break;
    results.push(...json);
    if (json.length < 100) break;
    page += 1;
  }
  return { results, complete: true };
}

async function main() {
  const command = parseCommand(commentBody);
  if (command.kind !== "deploy-request" && command.kind !== "release-request") {
    writeOutput({ decision: "noop", reason: '"not a recognized /visual-review command"' });
    return;
  }

  const privileged = await hasWriteAccess({ owner, repo, actor, token });
  if (!privileged) {
    await postComment(`@${actor} this comment was ignored — \`/visual-review\` commands require write access to this repository.`);
    writeOutput({ decision: "noop", reason: '"actor lacks write access"' });
    return;
  }

  const prResponse = await ghFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  if (!prResponse.ok) return reject("could not resolve this pull request via the API");
  const pr = await prResponse.json();

  if (pr.head.repo?.full_name !== pr.base.repo?.full_name) {
    return reject(
      "fork PRs aren't eligible for the lightweight visual-review deploy — use the full `acceptance` label path instead.",
    );
  }

  if (command.kind === "release-request") {
    writeOutput({ decision: "release", reason: '"explicit release request"', head_sha: pr.head.sha });
    return;
  }

  // deploy-request from here on
  const headSha = pr.head.sha;

  const statusResponse = await ghFetch(`/repos/${owner}/${repo}/commits/${headSha}/status`);
  const status = statusResponse.ok ? await statusResponse.json() : null;
  if (!status || status.state !== "success") {
    return reject(
      `required technical/security checks are not all green yet for ${headSha} (combined status: ${status?.state ?? "unknown"}). Wait for CI before requesting a visual-review deploy.`,
    );
  }

  const { results: files, complete: filesComplete } = await paginateAll(`/repos/${owner}/${repo}/pulls/${prNumber}/files`);
  if (!filesComplete) return reject("could not retrieve the complete changed-file list — failing closed.");

  const eligibility = classifyLightweightDeployEligibility(files.map((f) => f.filename));
  if (!eligibility.eligible) {
    return reject(`${eligibility.reason} This PR needs the full \`acceptance\` label path instead.`);
  }

  writeOutput({ decision: "deploy", reason: '"eligible"', head_sha: headSha });
}

main().catch(async (err) => {
  console.error(err);
  try {
    await postComment(`\`/visual-review\` request failed with an internal error: ${err.message}`);
  } catch {
    // best effort
  }
  writeOutput({ decision: "reject", reason: JSON.stringify(`internal error: ${err.message}`) });
});
