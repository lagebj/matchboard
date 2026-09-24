# Issue and ARR workflow

This module answers one recurring question: while doing a task, you find something you are not
fixing right now — a bug, a mismatch, a piece of duplicated logic. Where does it go? This applies
uniformly across every coding agent working in this repository (Claude Code, OpenCode, GitHub
Copilot CLI, or any other) — the mechanics below use the repository's own tools, not anything
tool-specific.

## The three-way test

Ask in this order:

1. **Does more than one implementation compete to be the truth?** Two write paths for the same
   fact, two data representations, a legacy component still active beside its replacement, a rule
   enforced in one adapter but not another. → **Write or update an ARR** (`architectural-residue-records`
   skill, recorded under `docs/arr/`). An ARR records a mismatch that *exists*; it does not decide
   anything.
2. **No competing implementation — is it just broken or missing?** → **File a GitHub issue.**
3. **Is it small enough to finish in the current branch, right now, without a meaningful
   architectural decision?** → **Just fix it.** Filing is overhead a same-branch fix doesn't need.

"Technical debt" is not itself a classification — it's where people default when they haven't
actually asked the question above. If the mismatch can change behavior, data integrity, or future
architecture, it's residue (step 1). If it can't, it's a normal defect (step 2).

These aren't mutually exclusive over time. An ARR can later need an ADR, when the repository must
actually choose between the competing implementations (see the `adr-governance` skill). A GitHub
issue can turn out, on investigation, to be architectural residue in disguise — when that happens,
redirect it into an ARR (and reference the issue from the ARR) rather than patching around a
disagreement the issue never named.

## Calibration — real examples from this repo

- **ARR**: `docs/arr/0045-dual-canonical-live-event-write-path.md` — the Durable Object path and
  the direct-HTTP fallback path can each independently persist a canonical live-match event. Two
  competing writers, recorded so neither gets extended by accident.
- **GitHub issue**: [#672](https://github.com/lagebj/matchboard/issues/672) — the League season
  rail's centering `useLayoutEffect` silently no-ops when its ref isn't populated yet. One broken
  effect; nothing else in the system disagrees about what should happen.
- **Neither — just fix it**: the `FollowLiveClient` snapshot-refetch race (PR #668) was a
  same-file, same-branch bug with an immediate regression test and fix in one pass. Filing it as
  anything first would have been pure overhead.

## Recording is required, not optional

Whenever a task surfaces a defect or architectural mismatch you are not resolving in the current
change, classify it against the test above and record it before finishing your response. Do not
leave a known problem undocumented just because the current task didn't ask for it.

Avoid noise, though: search existing issues (`list_issues`/`get_issue_context` below) and
`docs/arr/` for the same finding first — never file a duplicate. Don't file for a cosmetic nit, a
speculative concern with no concrete evidence, or a feature idea with no defect behind it (a
feature idea is a product conversation, not an issue filed unilaterally).

## Filing a GitHub issue

Use the `github-issues` swamp model (`models/@webframp/github/github-issues.yaml`, the
`@webframp/github` extension) — not `gh issue create` directly, and not any ad-hoc script:

```bash
swamp model method run github-issues create_issue \
  --input repo=lagebj/matchboard \
  --input title="..." \
  --input body="..." \
  --input idempotencyKey="<kebab-slug>-<YYYYMMDD>"
```

For a body longer than a shell argument comfortably holds, write it to a YAML file and use
`--input-file` instead of individual `--input` flags. If swamp reports the model or extension
can't be resolved, run `swamp extension pull @webframp/github` first (its version is pinned in
`extensions/models/upstream_extensions.json`), then retry.

Write the body so a *different* session — possibly a different tool entirely — can pick it up
without re-investigating: what's wrong, where (exact files/lines), why (root cause if known, or
the concrete candidates you ruled in/out), how to reproduce or what regression test should go red
first, and links to any ADR/ARR/doc describing the intended behavior. `create_issue` has no
labels input — apply the repository's existing labels afterward with `gh issue edit <number>
--add-label <label>`.

To pick an issue back up later:

```bash
swamp model method run github-issues get_issue_context \
  --input repo=lagebj/matchboard --input number=<N>
```

## Writing or updating an ARR

Follow the `architectural-residue-records` skill in full — it owns the lifecycle (`Identified` →
`Confirmed` → `Dispositioned` → `Resolved`/`Superseded`/`Invalidated`), the append-only rule for
confirmed findings, and containment requirements. In short: search `docs/arr/` for the same
underlying mismatch first, use the next sequential `docs/arr/NNNN-*.md` filename, and never
rewrite a confirmed finding — extend it with dated history instead.

## Relevant references

- `architectural-residue-records` skill — full lifecycle, template, containment rules
- `adr-governance` skill — when an ARR needs a decision
- `docs/arr/` — all current ARRs
- `docs/adr/` — all current ADRs
- `extensions/models/upstream_extensions.json`, `models/@webframp/github/github-issues.yaml` —
  the GitHub issue-filing model's pinned extension and definition
