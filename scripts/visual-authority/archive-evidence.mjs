#!/usr/bin/env node
// Visual Authority Gate (ADR-0159 follow-up, extended by ADR-0161) — durable evidence archival.
// Runs only in the archive-evidence job of .github/workflows/visual-authority-gate.yml, after the
// gate job itself has already reported APPROVED — never the other way around. Approval and
// archival are deliberately separate concerns (see ADR-0159's "2026-11-09 follow-up"): this script
// can fail, retry, or be skipped entirely without ever affecting the owner's approval decision,
// which the gate job already recorded via the Checks API before this job even starts.
//
// For each scenario the gate just approved: first looks for the most recent successful
// ui-lab-visual-review.yml run for the approved revision (CAPTURE_REVIEW evidence — screenshots
// verified by sha256 against capture-attestation.json). ADR-0161: capture is now on-demand, so
// this will often find nothing for an otherwise-valid approval — when that happens, this script
// checks the PR's own comment thread (the same thread that is already the sole approval ledger)
// for a real visual-review-deploy.yml "Deployed PR #<n> (`<sha>`) to the Test slot" comment
// matching the approved revision (DEPLOYMENT_REVIEW evidence — no screenshots, just the
// deployment record). If neither exists, the archive log says so explicitly
// (NO_EVIDENCE_RECORDED) rather than looking identical to a successful archive. Every outcome
// creates-or-reuses a GitHub Release tagged deterministically from the scenario ID and approved
// revision. Idempotent: re-running this for an already-archived (scenario, revision) pair is a
// no-op, never a duplicate release and never an overwrite of a different revision's evidence.
//
// This job is granted `contents: write` — nothing else in this workflow has it, and this script
// never executes anything checked out from a PR's own ref (same invariant as the gate job itself).
// No secrets, tokens, cookies, env vars, or session data are ever read or archived here — only PR
// metadata, screenshot files/hashes, and comment text already visible on the public PR thread.
//
// Required env: GH_TOKEN, GITHUB_REPOSITORY (owner/repo), HEAD_SHA, PR_NUMBER,
//   APPROVED_SCENARIOS_JSON (compact JSON array of {scenarioId, approvedRevision}, written by
//   run-gate.mjs's job output)

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { releaseTagFor } from "./evidence-tag.mjs";
import { classifyEvidence, findDeploymentCommentForRevision, EVIDENCE_TYPES } from "./evidence-model.mjs";

const token = requireEnv("GH_TOKEN");
const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
const headSha = requireEnv("HEAD_SHA");
const prNumber = requireEnv("PR_NUMBER");
const approvedScenarios = JSON.parse(requireEnv("APPROVED_SCENARIOS_JSON"));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function ghFetch(apiPath, init = {}) {
  return fetch(`https://api.github.com${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "matchboard-visual-authority-archive",
      ...(init.headers ?? {}),
    },
  });
}

async function findLatestSuccessfulCaptureRun() {
  const response = await ghFetch(
    `/repos/${owner}/${repo}/actions/workflows/ui-lab-visual-review.yml/runs?head_sha=${headSha}&status=success&per_page=10`,
  );
  if (!response.ok) return null;
  const json = await response.json();
  const runs = json.workflow_runs ?? [];
  if (runs.length === 0) return null;
  return runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

// Same comment thread run-gate.mjs already treats as the sole approval ledger (ADR-0159) — read
// here only to detect an existing "Deployed PR #<n> (`<sha>`)" record, never to make or alter any
// approval decision.
async function getIssueComments() {
  const results = [];
  let page = 1;
  for (;;) {
    const response = await ghFetch(`/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`);
    if (!response.ok) return results; // best-effort: a failed fetch here just means DEPLOYMENT_REVIEW can't be detected this run, never a fabricated result.
    const json = await response.json();
    if (!Array.isArray(json) || json.length === 0) break;
    results.push(...json);
    if (json.length < 100) break;
    page += 1;
  }
  return results;
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function findFilesRecursive(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFilesRecursive(full));
    else results.push(full);
  }
  return results;
}

function releaseExists(tag) {
  try {
    execFileSync("gh", ["release", "view", tag, "--repo", `${owner}/${repo}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function createRelease(tag, title, notes, assetPaths) {
  execFileSync(
    "gh",
    ["release", "create", tag, ...assetPaths, "--repo", `${owner}/${repo}`, "--title", title, "--notes", notes],
    { stdio: "inherit", env: { ...process.env, GH_TOKEN: token } },
  );
}

async function archiveScenarioAsDeploymentReview(scenario) {
  const { scenarioId, approvedRevision } = scenario;
  const tag = releaseTagFor(scenarioId, approvedRevision);

  if (releaseExists(tag)) {
    return { scenarioId, status: "already-archived", tag, evidenceType: EVIDENCE_TYPES.DEPLOYMENT_REVIEW };
  }

  try {
    createRelease(
      tag,
      `Visual evidence: ${scenarioId} @ ${approvedRevision.slice(0, 12)} (deployment review)`,
      `Durable record that ${scenarioId}'s approval at ${approvedRevision} was reviewed via a real Test-slot ` +
        "deployment (ADR-0161), not a screenshot capture — no capture run exists for this revision, and no " +
        "screenshot assets are attached to this release.\n\n" +
        "This release is evidence retention only — see the originating PR's comment thread for the actual " +
        "owner approval decision and the deployment comment this record was derived from.",
      [],
    );
  } catch (err) {
    return { scenarioId, status: "failed", reason: `gh release create failed: ${err.message}`, evidenceType: EVIDENCE_TYPES.DEPLOYMENT_REVIEW };
  }

  return { scenarioId, status: "archived", tag, evidenceType: EVIDENCE_TYPES.DEPLOYMENT_REVIEW };
}

async function archiveScenarioFromCapture(scenario, runDir) {
  const { scenarioId, approvedRevision } = scenario;
  const tag = releaseTagFor(scenarioId, approvedRevision);

  if (releaseExists(tag)) {
    return { scenarioId, status: "already-archived", tag, evidenceType: EVIDENCE_TYPES.CAPTURE_REVIEW };
  }

  const allFiles = findFilesRecursive(runDir);
  const attestationPath = allFiles.find((f) => path.basename(f) === "capture-attestation.json" && f.includes(scenarioId));
  const attestationPathFallback = attestationPath ?? allFiles.find((f) => path.basename(f) === "capture-attestation.json");
  if (!attestationPathFallback) {
    return { scenarioId, status: "failed", reason: "No capture-attestation.json found among downloaded artifacts." };
  }

  let attestation;
  try {
    attestation = JSON.parse(readFileSync(attestationPathFallback, "utf8"));
  } catch {
    return { scenarioId, status: "failed", reason: "capture-attestation.json was not valid JSON." };
  }

  const records = (attestation.captures ?? attestation.entries ?? []).filter(
    (entry) => !entry.scenarioId || entry.scenarioId === scenarioId,
  );
  if (records.length === 0) {
    return { scenarioId, status: "failed", reason: "No attestation records found for this scenario." };
  }

  const verifiedAssets = [];
  for (const record of records) {
    const file = allFiles.find((f) => f.endsWith(record.file ?? "__no-file__"));
    if (!file || !statSync(file).isFile()) {
      return { scenarioId, status: "failed", reason: `Screenshot referenced by attestation (${record.file}) was not found among downloaded artifacts.` };
    }
    const actualHash = sha256File(file);
    if (record.sha256 && actualHash !== record.sha256) {
      return { scenarioId, status: "failed", reason: `Screenshot hash mismatch for ${record.file} — refusing to archive unverified evidence.` };
    }
    verifiedAssets.push(file);
  }

  try {
    createRelease(
      tag,
      `Visual evidence: ${scenarioId} @ ${approvedRevision.slice(0, 12)}`,
      `Durable archive of the capture evidence reviewed for ${scenarioId}'s approval at ${approvedRevision}.\n\n` +
        "This release is evidence retention only — see the originating PR's comment thread for the actual owner approval decision.",
      verifiedAssets,
    );
  } catch (err) {
    return { scenarioId, status: "failed", reason: `gh release create failed: ${err.message}`, evidenceType: EVIDENCE_TYPES.CAPTURE_REVIEW };
  }

  return { scenarioId, status: "archived", tag, evidenceType: EVIDENCE_TYPES.CAPTURE_REVIEW };
}

async function main() {
  if (approvedScenarios.length === 0) {
    console.log("No approved scenarios to archive.");
    return;
  }

  const run = await findLatestSuccessfulCaptureRun();
  // ADR-0161: capture is now on-demand, so a missing run is expected, not an anomaly. Only fetch
  // the comment thread (a separate API call) when it's actually needed to decide DEPLOYMENT_REVIEW
  // vs NO_EVIDENCE_RECORDED.
  const comments = run ? [] : await getIssueComments();

  let workDir = null;
  if (run) {
    workDir = mkdtempSync(path.join(tmpdir(), "visual-evidence-"));
    execFileSync("gh", ["run", "download", String(run.id), "--repo", `${owner}/${repo}`, "--dir", workDir], {
      stdio: "inherit",
      env: { ...process.env, GH_TOKEN: token },
    });
  }

  try {
    const results = [];
    for (const scenario of approvedScenarios) {
      if (run) {
        results.push(await archiveScenarioFromCapture(scenario, workDir));
        continue;
      }
      const deploymentCommentFound = findDeploymentCommentForRevision(comments, scenario.approvedRevision);
      const evidenceType = classifyEvidence({ captureRunFound: false, deploymentCommentFound });
      if (evidenceType === EVIDENCE_TYPES.DEPLOYMENT_REVIEW) {
        results.push(await archiveScenarioAsDeploymentReview(scenario));
      } else {
        results.push({
          scenarioId: scenario.scenarioId,
          status: "deferred",
          evidenceType: EVIDENCE_TYPES.NO_EVIDENCE_RECORDED,
          reason:
            "No successful capture run and no visual-review-deploy.yml deployment comment found for this revision — archival deferred (not a failure: approval remains valid regardless).",
        });
      }
    }

    for (const r of results) {
      console.log(`${r.scenarioId}: ${r.status} [${r.evidenceType}]${r.tag ? ` (${r.tag})` : ""}${r.reason ? ` — ${r.reason}` : ""}`);
    }
    const failed = results.filter((r) => r.status === "failed");
    if (failed.length > 0) {
      console.log(`${failed.length} scenario(s) failed to archive — this does NOT affect their approval validity. Retry is safe and idempotent.`);
    }
  } finally {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  // Archival failure must never look like an approval failure. Log clearly and exit 0 — this job
  // has no bearing on merge eligibility (see the workflow's `if:` condition, which only runs this
  // job after the gate job already succeeded).
  console.error("Evidence archival failed:", err);
  process.exitCode = 0;
});
