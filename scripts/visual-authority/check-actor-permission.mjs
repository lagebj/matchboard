// Visual Authority Gate (ADR-0159) — real-time GitHub collaborator-permission check. This is
// the one real defense the gate has: a comment only counts as approval/rejection if, AT THE TIME
// THE GATE EVALUATES IT, the commenting actor still has write/maintain/admin access to this repo
// — re-checked on every evaluation, not cached, so a later permission revocation invalidates a
// stale approval automatically. See ADR-0159's "Self-approval / credential-indistinguishability
// limitation" section for what this check does and does not defend against.

const PRIVILEGED = new Set(["write", "maintain", "admin"]);

/**
 * @param {{owner: string, repo: string, actor: string, token: string, fetchImpl?: typeof fetch}} args
 * @returns {Promise<boolean>}
 */
export async function hasWriteAccess({ owner, repo, actor, token, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${owner}/${repo}/collaborators/${encodeURIComponent(actor)}/permission`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "matchboard-visual-authority-gate",
        },
      },
    );
    if (!response.ok) return false;
    const json = await response.json();
    return PRIVILEGED.has(json.permission);
  } catch {
    return false;
  }
}
