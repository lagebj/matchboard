// Visual Authority Gate (ADR-0159 follow-up) — revision-identity validation. A `/visual-approve
// <sha>`/`/visual-reject <sha>` comment must reference a commit that is actually part of this PR:
// its current head, one of its own commits, or (for a merged PR) its synthetic merge commit —
// never an arbitrary unrelated SHA that merely happens to parse as hex. Without this check, the
// only thing standing between an approval and an unrelated commit was fingerprint equality, which
// is a coincidence-prone, not identity-based, defense.

/**
 * @param {object} args
 * @param {string} args.sha - as referenced in the comment (7-40 lowercase hex, already validated
 *   by parse-comment.mjs's SHA_RE; may be a valid abbreviation of a longer known SHA).
 * @param {string} args.headSha - the PR's current head SHA.
 * @param {string[]} [args.prCommitShas] - every commit SHA that is part of this PR's own history.
 * @param {string | null} [args.mergeCommitSha] - the PR's synthetic merge commit SHA, once merged.
 * @returns {boolean}
 */
export function isKnownRevision({ sha, headSha, prCommitShas = [], mergeCommitSha = null }) {
  const needle = sha.toLowerCase();
  const known = [headSha, mergeCommitSha, ...prCommitShas].filter(Boolean).map((s) => s.toLowerCase());
  return known.some((full) => full.startsWith(needle));
}
