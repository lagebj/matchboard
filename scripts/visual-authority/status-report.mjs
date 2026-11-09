#!/usr/bin/env node
// Visual Authority Gate (ADR-0159 follow-up) — read-only, cross-PR approval status reporting.
// Wired as `npm run visual-authority:status -- --gate B [--format table|json]`.
//
// Reuses the exact same resolve-approval.mjs core the live gate uses — there is only ever one
// approval-decision algorithm in this repository, never a second one for reporting. For each
// scenario in the requested gate's manifests, resolves its introducing PR from the candidate's own
// `sourcePr` origin metadata (never an unbounded repository-wide search), fetches that PR's
// comments/commits once per DISTINCT source PR (bounded by the number of waves, not the number of
// scenarios), and reports the same per-scenario EffectiveVisualApproval the gate would compute.
//
// A scenario with no verified `sourcePr` reports UNVERIFIABLE with the missing-provenance reason —
// never a guessed state. A scenario whose componentOwners were also touched by a LATER PR than its
// own introducing one is a known, disclosed limitation: this report only evaluates each scenario
// against its own introducing PR's comment thread, not every PR that ever touched its dependencies
// (see the PR description's "Remaining limitations").
//
// Required env: GH_TOKEN, GITHUB_REPOSITORY (owner/repo)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeFingerprint } from "./fingerprint.mjs";
import { hasWriteAccess } from "./check-actor-permission.mjs";
import { loadVisualAuthorityConfig, isConfiguredApprover } from "./visual-authority-config.mjs";
import { isKnownRevision } from "./revision.mjs";
import { resolveApproval } from "./resolve-approval.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const UI_LAB_DOCS_DIR = path.join(REPO_ROOT, "docs", "ui-lab");

function parseArgs(argv) {
  const args = { gate: null, format: "table" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--gate") args.gate = argv[++i];
    else if (argv[i] === "--format") args.format = argv[++i];
  }
  return args;
}

function loadScenarioRegistryFromDisk(gate) {
  const gatePrefix = `gate-${gate.toLowerCase()}-`;
  const waveDirs = readdirSync(UI_LAB_DOCS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(gatePrefix) && d.name.endsWith("-candidates"))
    .map((d) => d.name)
    .sort();

  const scenarios = [];
  for (const dir of waveDirs) {
    const manifestPath = path.join(UI_LAB_DOCS_DIR, dir, "candidate_manifest.json");
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    for (const candidate of manifest.candidates ?? []) {
      if (!candidate.scenarioId) continue;
      scenarios.push({
        scenarioId: candidate.scenarioId,
        componentOwners: Array.isArray(candidate.componentOwners) ? candidate.componentOwners : [],
        sourcePr: typeof candidate.sourcePr === "number" ? candidate.sourcePr : null,
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
  return scenarios;
}

function makeGhClient(token, owner, repo) {
  async function ghFetch(apiPath, init = {}) {
    return fetch(`https://api.github.com${apiPath}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "matchboard-visual-authority-status-report",
        ...(init.headers ?? {}),
      },
    });
  }
  async function paginate(apiPath) {
    const results = [];
    let page = 1;
    let complete = true;
    for (;;) {
      const response = await ghFetch(`${apiPath}${apiPath.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
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
  async function readFileAtRef(filePath, ref) {
    const response = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${ref}`);
    if (!response.ok) return null;
    const json = await response.json();
    if (json.encoding !== "base64" || typeof json.content !== "string") return null;
    return Buffer.from(json.content, "base64").toString("utf8");
  }
  async function getPr(prNumber) {
    const response = await ghFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`);
    if (!response.ok) return null;
    return response.json();
  }
  // Only called as a fallback when isKnownRevision()'s cheap checks don't already resolve a
  // referenced SHA — see revision.mjs's header for why a GitHub-synthetic merge-preview commit
  // needs this.
  async function getCommitParentShas(sha) {
    try {
      const response = await ghFetch(`/repos/${owner}/${repo}/commits/${sha}`);
      if (!response.ok) return null;
      const json = await response.json();
      return Array.isArray(json.parents) ? json.parents.map((p) => p.sha) : null;
    } catch {
      return null;
    }
  }
  return { ghFetch, paginate, readFileAtRef, getPr, getCommitParentShas };
}

async function isKnownRevisionLazy(client, sha, { headSha, prCommitShas, mergeCommitSha }) {
  if (isKnownRevision({ sha, headSha, prCommitShas, mergeCommitSha })) return true;
  const parentShas = await client.getCommitParentShas(sha);
  if (!parentShas) return false;
  return isKnownRevision({ sha, headSha, prCommitShas, mergeCommitSha, parentShas });
}

async function resolveScenariosForSourcePr({ client, owner, repo, sourcePr, scenarios, isVisualAuthority }) {
  const pr = await client.getPr(sourcePr);
  if (!pr) {
    return new Map(scenarios.map((s) => [s.scenarioId, unverifiable(s, `Could not fetch PR #${sourcePr}.`)]));
  }
  const headSha = pr.head.sha;
  const mergeCommitSha = pr.merge_commit_sha ?? null;

  const { results: files } = await client.paginate(`/repos/${owner}/${repo}/pulls/${sourcePr}/files`);
  const changedFiles = files.map((f) => f.filename);

  const { results: rawComments } = await client.paginate(`/repos/${owner}/${repo}/issues/${sourcePr}/comments`);
  const comments = rawComments.map((c) => ({ body: c.body ?? "", user: c.user?.login ?? "", createdAt: c.created_at, id: c.id }));

  const { results: rawCommits } = await client.paginate(`/repos/${owner}/${repo}/pulls/${sourcePr}/commits`);
  const prCommitShas = rawCommits.map((c) => c.sha);

  const distinctActors = [...new Set(comments.map((c) => c.user).filter(Boolean))];
  const privilegeByActor = new Map();
  for (const actor of distinctActors) {
    privilegeByActor.set(actor, await hasWriteAccess({ owner, repo, actor, token: client.token }));
  }

  async function fingerprintForScenarioAtRef(scenario, ref) {
    const reader = new Map();
    for (const p of scenario.componentOwners) reader.set(p, await client.readFileAtRef(p, ref));
    return computeFingerprint(scenario.componentOwners, (p) => reader.get(p) ?? null);
  }

  const currentFingerprints = new Map();
  for (const scenario of scenarios) {
    currentFingerprints.set(scenario.scenarioId, await fingerprintForScenarioAtRef(scenario, headSha));
  }

  const referencedShas = new Set();
  for (const c of comments) {
    const m = c.body.match(/^\/visual-approve\s+([0-9a-f]{7,40})/im);
    if (m) referencedShas.add(m[1].toLowerCase());
  }
  const knownByReferencedSha = new Map();
  for (const sha of referencedShas) {
    if (sha === headSha.toLowerCase()) continue;
    knownByReferencedSha.set(sha, await isKnownRevisionLazy(client, sha, { headSha, prCommitShas, mergeCommitSha }));
  }

  const fingerprintAtShaCache = new Map();
  for (const scenario of scenarios) {
    for (const sha of referencedShas) {
      if (sha === headSha.toLowerCase()) continue;
      const key = `${scenario.scenarioId}::${sha}`;
      if (!knownByReferencedSha.get(sha)) {
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

  const { scenarios: scenarioResults } = resolveApproval({
    scenarios,
    changedFiles,
    comments,
    isPrivileged: (login) => privilegeByActor.get(login) === true,
    isVisualAuthority,
    currentFingerprintForScenario: (id) => currentFingerprints.get(id) ?? "",
    fingerprintAtShaForScenario: (id, sha) =>
      fingerprintAtShaCache.get(`${id}::${sha.toLowerCase()}`) ?? (sha.toLowerCase() === headSha.toLowerCase() ? currentFingerprints.get(id) ?? "" : null),
    currentSha: headSha,
  });

  return new Map(
    [...scenarioResults.entries()].map(([id, r]) => [id, { ...r, sourcePr, prUrl: pr.html_url }]),
  );
}

function unverifiable(scenario, reason) {
  return {
    scenarioId: scenario.scenarioId,
    state: "UNVERIFIABLE",
    source: null,
    approvedBy: null,
    approvedAt: null,
    approvedRevision: null,
    sourcePr: scenario.sourcePr,
    prUrl: null,
    reason,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.gate) {
    console.error("Usage: node status-report.mjs --gate <A|B> [--format table|json]");
    process.exit(1);
  }
  const token = process.env.GH_TOKEN;
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "lagebj/matchboard").split("/");
  if (!token) {
    console.error("GH_TOKEN is required");
    process.exit(1);
  }

  const scenarios = loadScenarioRegistryFromDisk(args.gate);
  const visualAuthorityConfig = loadVisualAuthorityConfig();
  const isVisualAuthority = (login) => isConfiguredApprover(login, visualAuthorityConfig);

  const client = makeGhClient(token, owner, repo);
  client.token = token;

  const byScenarioId = new Map();
  const withProvenance = scenarios.filter((s) => s.sourcePr !== null);
  const withoutProvenance = scenarios.filter((s) => s.sourcePr === null);

  for (const s of withoutProvenance) {
    byScenarioId.set(s.scenarioId, unverifiable(s, "No verified sourcePr recorded for this candidate."));
  }

  const distinctSourcePrs = [...new Set(withProvenance.map((s) => s.sourcePr))].sort((a, b) => a - b);
  for (const sourcePr of distinctSourcePrs) {
    const scenariosForThisPr = withProvenance.filter((s) => s.sourcePr === sourcePr);
    const resolved = await resolveScenariosForSourcePr({ client, owner, repo, sourcePr, scenarios: scenariosForThisPr, isVisualAuthority });
    for (const [id, r] of resolved) byScenarioId.set(id, r);
  }

  const rows = [...byScenarioId.values()].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  if (args.format === "json") {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const header = ["Scenario", "State", "Source", "SourcePR", "ApprovedBy", "Revision"];
  const widths = header.map((h) => h.length);
  const lines = rows.map((r) => {
    const cells = [
      r.scenarioId,
      r.state,
      r.source ?? "-",
      r.sourcePr ? `#${r.sourcePr}` : "-",
      r.approvedBy ?? "-",
      r.approvedRevision ? r.approvedRevision.slice(0, 10) : "-",
    ];
    cells.forEach((c, i) => (widths[i] = Math.max(widths[i], String(c).length)));
    return cells;
  });
  const printRow = (cells) => console.log(cells.map((c, i) => String(c).padEnd(widths[i])).join("  "));
  printRow(header);
  printRow(widths.map((w) => "-".repeat(w)));
  for (const line of lines) printRow(line);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
