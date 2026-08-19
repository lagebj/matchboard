# ADR-0070: CodeQL enabled via GitHub public-repository default setup

## Status

Accepted

## Date

2026-08-19

## Context

`AGENTS.md` and `SECURITY.md` stated that CodeQL was excluded from Matchboard's security
programme: "CodeQL is excluded because Matchboard's ELv2 license is not OSI Open Source. Do not
add CodeQL unless entitlement is confirmed." That text was written from a specific reading of
GitHub's standalone CodeQL Terms and Conditions, which restrict free use of the redistributed
CodeQL CLI/query packs to analysis of Open Source Software (OSI-approved license), unless the
analyzing party already holds a GitHub Advanced Security entitlement. Matchboard is licensed
under Elastic License 2.0 — source-available, not OSI-approved — so that specific document was
read as blocking CodeQL for this repository.

While working an unrelated PR (#297), an agent discovered CodeQL default-setup checks
(`Analyze (actions/javascript-typescript/python)`, `CodeQL`) actively running and passing on
this repository's pull requests, with no `codeql.yml` workflow file present in the repository —
meaning CodeQL is enabled at the GitHub repository-settings level (Settings → Code security →
Code scanning → Default setup), not via in-repo configuration. This directly contradicted the
documented "excluded" stance. `docs/arr/` tracking flagged this as an unresolved contradiction
pending a maintainer decision, since AGENTS.md reserves licensing and commercial decisions for
"the Matchboard maintainer/copyright holder."

Verified facts at decision time (`gh repo view lagebj/matchboard --json visibility`):
- The repository is **public** on GitHub.com (`visibility: PUBLIC`).
- GitHub's own code scanning default setup (which runs CodeQL as a hosted GitHub product feature
  triggered from repository settings, not a self-hosted/redistributed CodeQL CLI invocation) is
  offered by GitHub at no additional cost to public repositories, independent of the repository's
  own software license. This is a separate offering from — and administered under different
  terms than — the standalone CodeQL Terms and Conditions that govern downloading and running the
  CodeQL CLI outside of GitHub's own hosted product.

## Decision

The Matchboard maintainer (repository owner) reviewed this distinction and elected to **keep
CodeQL's GitHub-hosted default setup enabled**, relying on the repository's public-repository
entitlement rather than adding or removing anything in-repo. This is a licensing/commercial
decision, made by the maintainer as required by AGENTS.md.

Consequently:
- `SECURITY.md`'s "CodeQL" and "CodeQL status" sections are rewritten to describe CodeQL as an
  active, GitHub-managed finding source (repository-settings-level, not an in-repo workflow),
  rather than "not included"/"not permitted".
- `AGENTS.md`'s standing rule is rewritten from "CodeQL is excluded... do not add unless
  entitlement is confirmed" to reflect that CodeQL is active via GitHub's public-repository
  default setup and must not be disabled or duplicated with an in-repo `codeql.yml` workflow
  without a new maintainer decision.
- The CodeQL CLI remains uninstalled in the devcontainer — GitHub's hosted default setup does not
  require it, and no local `npm run security:*` script depends on it.
- No `codeql.yml` workflow is added to `.github/workflows/` — default setup is a repository
  setting, not code; adding a competing in-repo workflow would conflict with it.

## Consequences

- Future agents must not "fix" CodeQL by disabling it, filing an issue to remove it, or adding an
  in-repo CodeQL workflow — the contradiction this ADR resolves is closed; CodeQL running is now
  the documented, intended state.
- If the repository's visibility ever changes (public → private), this decision must be
  revisited: GitHub's public-repository code-scanning entitlement would no longer apply, and
  CodeQL would then require a paid GitHub Advanced Security entitlement to remain compliant with
  its standalone Terms and Conditions, or must be disabled.
- This ADR records a licensing/commercial risk-acceptance made by the maintainer; it is not a
  legal opinion and should be revisited if GitHub's terms or this repository's licensing/
  visibility change.

## Related decisions

- `docs/adr/0067-bypass-auth-architectural-residue.md` — same "licensing/commercial decisions
  remain with the maintainer" governance pattern applied to a different question.

## History

- 2026-08-19: Accepted. Maintainer decision to keep CodeQL default setup active on the public
  repository; `AGENTS.md`/`SECURITY.md` reconciled to match.
