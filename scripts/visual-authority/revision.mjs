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
// head AT THE TIME IT WAS GENERATED — so it's identified structurally, by one of its own parents
// being a commit this PR has EVER had as its own (any entry in `prCommitShas`, not only the
// CURRENT `headSha`), rather than by the ref that produced it still existing.
//
// Confirmed live (PR #829, 2026-11-22): checking only against the literal current `headSha` broke
// the moment even one more commit was pushed after the approval — GitHub regenerates
// `refs/pull/<n>/merge` on every push, so an OLDER merge-preview commit's own PR-side parent is the
// PR's head AS OF THAT EARLIER PUSH, never the new one. That earlier head is still a real commit
// this PR has always owned (present in `prCommitShas`), so it must still count as known — an
// approval must not be silently and permanently unverifiable the instant any further commit lands,
// regardless of whether that commit touches the approved scenario's own files at all.

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
  const knownSet = new Set(known);
  return parentShas.map((s) => s.toLowerCase()).some((parent) => knownSet.has(parent));
}
