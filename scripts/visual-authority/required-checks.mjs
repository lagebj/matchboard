// ADR-0159 — verifies every one of this repo's required checks (ruleset-defined, fetched live so
// this never drifts out of sync with the real ruleset) is green for a given commit SHA.
//
// Every one of this repo's 12 required checks (ruleset 21317362) is a GitHub Actions Check Run
// (integration_id 15368), NOT a classic commit status — empirically confirmed against a real PR
// head commit before writing this: `GET /commits/{sha}/status` (the combined-status endpoint)
// returned only a single classic "Vercel" status and was completely blind to Lint/Tests/
// TypeScript Check/etc. Using that endpoint alone would let a deploy proceed while real CI is
// still red or still running. This reads the Check Runs API instead, and takes the LATEST run of
// each required name (a required check can be re-run, producing multiple check-run records for
// the same name/SHA on the same commit).

const RULESET_ID = "21317362";

export async function getRequiredContexts({ owner, repo, fetchImpl }) {
  const response = await fetchImpl(`/repos/${owner}/${repo}/rulesets/${RULESET_ID}`);
  if (!response.ok) return null;
  const ruleset = await response.json();
  const rule = ruleset.rules?.find((r) => r.type === "required_status_checks");
  const contexts = rule?.parameters?.required_status_checks?.map((c) => c.context);
  return Array.isArray(contexts) && contexts.length > 0 ? contexts : null;
}

/**
 * @param {string} path
 * @param {typeof fetch} fetchImpl
 * @param {string | null} listKey - GitHub's list endpoints are inconsistent: `/pulls/{n}/files`
 *   and `/issues/{n}/comments` return a bare JSON array, but `/commits/{sha}/check-runs` returns
 *   a wrapped object `{total_count, check_runs: [...]}`. Passing the wrong shape here previously
 *   caused every required check to silently read as "has not run yet" (an empty array, not an
 *   error) — found via this repo's own first real `/visual-review deploy` request, not caught by
 *   unit tests whose mocks encoded the same wrong assumption. Pass the key to unwrap (e.g.
 *   "check_runs"), or `null` for a bare-array response.
 */
export async function paginateAll(path, fetchImpl, listKey = null) {
  const results = [];
  let page = 1;
  for (;;) {
    const response = await fetchImpl(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    if (!response.ok) return { results, complete: false };
    const body = await response.json();
    const page_items = listKey ? body?.[listKey] : body;
    if (!Array.isArray(page_items) || page_items.length === 0) break;
    results.push(...page_items);
    if (page_items.length < 100) break;
    page += 1;
  }
  return { results, complete: true };
}

/** Pure decision core — given the required-context list and the full check-run list for a SHA,
 * decide whether every required context is green. Exported separately from the network-fetching
 * wrapper below so the decision logic itself is unit-testable without mocking HTTP. */
export function evaluateRequiredChecks(requiredContexts, checkRuns) {
  for (const context of requiredContexts) {
    const matching = checkRuns.filter((r) => r.name === context);
    if (matching.length === 0) return { allGreen: false, reason: `required check "${context}" has not run yet for this commit` };
    const latest = matching.reduce((a, b) => (new Date(a.started_at ?? 0) > new Date(b.started_at ?? 0) ? a : b));
    if (latest.status !== "completed") return { allGreen: false, reason: `required check "${context}" is still ${latest.status}` };
    if (!["success", "skipped", "neutral"].includes(latest.conclusion)) {
      return { allGreen: false, reason: `required check "${context}" concluded "${latest.conclusion}"` };
    }
  }
  return { allGreen: true };
}

export async function requiredChecksGreen({ owner, repo, sha, fetchImpl }) {
  const requiredContexts = await getRequiredContexts({ owner, repo, fetchImpl });
  if (!requiredContexts) return { allGreen: false, reason: "could not resolve the required-checks list from the ruleset" };

  const { results: checkRuns, complete } = await paginateAll(`/repos/${owner}/${repo}/commits/${sha}/check-runs`, fetchImpl, "check_runs");
  if (!complete) return { allGreen: false, reason: "could not retrieve the complete check-run list" };

  return evaluateRequiredChecks(requiredContexts, checkRuns);
}
