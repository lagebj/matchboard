// Visual Authority Gate (ADR-0159 follow-up) — revision-identity validation. A `/visual-approve
// <sha>`/`/visual-reject <sha>` comment must reference a commit that is actually part of this PR:
// its current head, one of its own commits, its real post-merge commit, or a GitHub-generated
// `refs/pull/<n>/merge` preview commit — never an arbitrary unrelated SHA that merely happens to
// parse as hex. Without this check, the only thing standing between an approval and an unrelated
// commit was fingerprint equality, which is a coincidence-prone, not identity-based, defense.
//
// The `refs/pull/<n>/merge` preview ref (what GitHub Actions' `pull_request` event often actually
// checks out) is ephemeral — GitHub stops resolving it once the PR merges or closes, so it cannot
// be looked up by ref after the fact. The commit OBJECT it pointed to remains fetchable by SHA
// indefinitely (confirmed against a real case: PR #822's `/visual-approve` referenced exactly this
// kind of commit). Such a commit is always a 2-parent merge of the PR's base tip and the PR's own
// head — so it's identified structurally, by one of its own parents being this PR's head SHA,
// rather than by the ref that produced it still existing.

/**
 * @param {object} args
 * @param {string} args.sha - as referenced in the comment (7-40 lowercase hex, already validated
 *   by parse-comment.mjs's SHA_RE; may be a valid abbreviation of a longer known SHA).
 * @param {string} args.headSha - the PR's current head SHA.
 * @param {string[]} [args.prCommitShas] - every commit SHA that is part of this PR's own history.
 * @param {string | null} [args.mergeCommitSha] - the PR's real post-merge commit SHA, once merged.
 * @param {string[]} [args.parentShas] - the referenced sha's own commit parents, if the caller
 *   already fetched them (only needed when the simpler checks above don't resolve it).
 * @returns {boolean}
 */
export function isKnownRevision({ sha, headSha, prCommitShas = [], mergeCommitSha = null, parentShas = [] }) {
  const needle = sha.toLowerCase();
  const known = [headSha, mergeCommitSha, ...prCommitShas].filter(Boolean).map((s) => s.toLowerCase());
  if (known.some((full) => full.startsWith(needle))) return true;
  return parentShas.map((s) => s.toLowerCase()).includes(headSha.toLowerCase());
}
