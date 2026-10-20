#!/usr/bin/env node
// Visual Authority Gate (ADR-0159) — orchestration for .github/workflows/visual-authority-gate.yml's
// `gate` job. Gathers everything from the GitHub API (paginated changed files, all PR comments,
// each distinct commenter's current permission, the current and any approve-referenced SHA's
// fingerprint via the Contents API — never actions/checkout, see ADR-0159), calls the pure
// evaluateGate() decision core once, then posts the result as a GitHub check run against the
// exact PR head SHA. Never reports before the full evaluation completes.
//
// Required env: GH_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER, HEAD_SHA

import { classify } from "./classify.mjs";
import { computeFingerprint, isFingerprintRelevant } from "./fingerprint.mjs";
import { hasWriteAccess } from "./check-actor-permission.mjs";
import { evaluateGate } from "./evaluate-gate.mjs";

const token = requireEnv("GH_TOKEN");
const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
const prNumber = requireEnv("PR_NUMBER");
const headSha = requireEnv("HEAD_SHA");

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

async function readFileAtRef(path, ref) {
  const response = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`);
  if (!response.ok) return null;
  const json = await response.json();
  if (json.encoding !== "base64" || typeof json.content !== "string") return null;
  return Buffer.from(json.content, "base64").toString("utf8");
}

async function fingerprintForRef(ref, relevantPaths) {
  const reader = new Map();
  for (const path of relevantPaths) {
    reader.set(path, await readFileAtRef(path, ref));
  }
  return computeFingerprint(relevantPaths, (p) => reader.get(p) ?? null);
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

async function main() {
  const { files, complete: filesComplete } = await getChangedFiles();
  const classification = classify(files, { incomplete: !filesComplete });

  if (!classification.applicable) {
    const result = evaluateGate({
      applicable: false,
      headSha,
      comments: [],
      isActorPrivileged: () => false,
      currentFingerprint: "",
      fingerprintAtSha: () => null,
    });
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

  const distinctActors = [...new Set(comments.map((c) => c.user).filter(Boolean))];
  const privilegeByActor = new Map();
  for (const actor of distinctActors) {
    privilegeByActor.set(actor, await hasWriteAccess({ owner, repo, actor, token }));
  }

  const relevantPaths = files.filter(isFingerprintRelevant);
  const currentFingerprint = await fingerprintForRef(headSha, relevantPaths);

  const referencedShas = new Set();
  for (const comment of comments) {
    const match = comment.body.match(/^\/visual-approve\s+([0-9a-f]{7,40})/im);
    if (match) referencedShas.add(match[1].toLowerCase());
  }
  const fingerprintBySha = new Map();
  for (const sha of referencedShas) {
    if (sha === headSha.toLowerCase()) continue;
    try {
      fingerprintBySha.set(sha, await fingerprintForRef(sha, relevantPaths));
    } catch {
      fingerprintBySha.set(sha, null);
    }
  }

  const result = evaluateGate({
    applicable: true,
    headSha,
    comments,
    isActorPrivileged: (login) => privilegeByActor.get(login) === true,
    currentFingerprint,
    fingerprintAtSha: (sha) => fingerprintBySha.get(sha.toLowerCase()) ?? (sha.toLowerCase() === headSha.toLowerCase() ? currentFingerprint : null),
  });

  await postCheckRun(result);
  console.log(`${result.state}: ${result.summary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
