// ADR-0159 — Test-slot lease storage.
//
// GitHub Actions repository VARIABLES cannot be written by the default `GITHUB_TOKEN` at all,
// regardless of the `permissions:` block granted — found via this repo's own first real
// `/visual-review deploy` attempt (`HTTP 403: Resource not accessible by integration` on
// `POST /repos/{owner}/{repo}/actions/variables`). This is a genuine GitHub platform
// restriction: Variables/Secrets management requires an elevated credential (a PAT or GitHub App
// installation token), unlike ordinary Issues or Contents writes, which `GITHUB_TOKEN` can do
// with the matching `permissions:` entry. The lease is instead stored as the body of one
// well-known, found-or-created GitHub Issue — `issues: write` is sufficient.

const LEASE_ISSUE_TITLE = "ADR-0159: Test-slot lease state (automated — do not close)";

export const EMPTY_LEASE = { prNumber: null, sha: null, actor: null, acquiredAt: null, status: "released", deploymentUrl: null };

export function parseLeaseBody(body) {
  const match = typeof body === "string" ? body.match(/```json\n([\s\S]*?)\n```/) : null;
  if (!match) return { ...EMPTY_LEASE };
  try {
    return { ...EMPTY_LEASE, ...JSON.parse(match[1]) };
  } catch {
    return { ...EMPTY_LEASE };
  }
}

export function renderLeaseBody(lease) {
  return [
    "This issue is automated state for the Visual Authority Gate's shared Test-slot lease",
    "(ADR-0159). Do not close or edit it manually — `/visual-review deploy` and",
    "`/visual-review release` PR comments manage it; it's also cleared automatically on PR close",
    "and before any baseline redeploy.",
    "",
    "```json",
    JSON.stringify(lease, null, 2),
    "```",
  ].join("\n");
}

async function findLeaseIssueNumber({ owner, repo, fetchImpl }) {
  const query = encodeURIComponent(`repo:${owner}/${repo} type:issue in:title "${LEASE_ISSUE_TITLE}"`);
  const response = await fetchImpl(`/search/issues?q=${query}`);
  if (!response.ok) return null;
  const json = await response.json();
  const match = json.items?.find((i) => i.title === LEASE_ISSUE_TITLE);
  return match?.number ?? null;
}

async function createLeaseIssue({ owner, repo, fetchImpl }, lease) {
  const response = await fetchImpl(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: LEASE_ISSUE_TITLE, body: renderLeaseBody(lease) }),
  });
  if (!response.ok) throw new Error(`Failed to create the Test-slot lease issue: ${response.status} ${await response.text()}`);
  const json = await response.json();
  return json.number;
}

/** @returns {Promise<typeof EMPTY_LEASE>} */
export async function getLease(ctx) {
  const number = await findLeaseIssueNumber(ctx);
  if (number === null) return { ...EMPTY_LEASE };
  const response = await ctx.fetchImpl(`/repos/${ctx.owner}/${ctx.repo}/issues/${number}`);
  if (!response.ok) return { ...EMPTY_LEASE };
  const json = await response.json();
  return parseLeaseBody(json.body);
}

/** Replaces the lease wholesale (full object, not a merge) — callers read-modify-write. */
export async function setLease(ctx, lease) {
  let number = await findLeaseIssueNumber(ctx);
  if (number === null) {
    number = await createLeaseIssue(ctx, lease);
    return;
  }
  const response = await ctx.fetchImpl(`/repos/${ctx.owner}/${ctx.repo}/issues/${number}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: renderLeaseBody(lease) }),
  });
  if (!response.ok) throw new Error(`Failed to update the Test-slot lease issue: ${response.status} ${await response.text()}`);
}

export async function clearLease(ctx) {
  await setLease(ctx, { ...EMPTY_LEASE });
}
