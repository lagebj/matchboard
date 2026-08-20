# ADR-0081: Fix broken OSV-Scanner and Gitleaks CI invocations (Phase 10 §54/§56)

## Status

Accepted

## Date

2026-08-20

## Context

The consolidation programme's Phase 10 audit (`PROGRAMME.md` §54-57, security governance) found
that two of `.github/workflows/security.yml`'s three SAST/dependency/secret-scanning jobs have
never actually executed successfully, on any run, since being introduced — confirmed by
inspecting a recent CI run's raw logs (`gh run view <id> --log`), not assumed:

- **OSV Dependency Scan**: `security/osv-scanner.toml` is written in YAML syntax
  (`version: "2"`, `scan:` / `- lockfile: ...`) despite being a `.toml` file consumed by
  `osv-scanner --config=security/osv-scanner.toml`. Every run fails immediately: `Failed to read
  config file: toml: line 1: expected '.' or '=', but got ':' instead`. The `scan:` key it
  attempted to use isn't a real config key at all — OSV-Scanner's actual config schema only
  supports `IgnoredVulns`, `PackageOverrides`, `ScanGoModVersion`, `GoVersionOverride`; scan
  targets are CLI arguments only (confirmed against the official docs,
  https://google.github.io/osv-scanner/configuration/).
- **Gitleaks Secret Detection**: the workflow calls `gitleaks detect --config-path
  security/gitleaks.toml ...`, but Gitleaks v8.22.1's actual flag is `--config` (or `-c`) — `-path`
  doesn't exist and every run fails immediately with `Error: unknown flag: --config-path`.
  `package.json`'s `security:secrets`/`security:secrets:history` scripts already use the correct
  `--config` flag — only the CI workflow's independently hand-rolled invocation had the wrong
  one, a drift bug, not a repo-wide misunderstanding of the tool. Fixing the flag alone still
  wasn't enough — `security/gitleaks.toml` itself used three top-level `[[allowlist]]` blocks (an
  invalid hybrid: array-of-tables syntax on the legacy singular key), which this PR's own live CI
  run then surfaced as a second, distinct failure: `Failed to load config error="1 error(s)
  decoding: * 'Allowlist' expected a map, got 'slice'"`. First attempt renamed the blocks to
  `[[allowlists]]` (plural) based on a web search describing that pluralization — this loaded
  without error, but a local reproduction (downloading the same Gitleaks v8.22.1 binary and
  diffing behavior against the official default `gitleaks.toml`, since the search result had
  conflated a *rule-scoped* `[rules.allowlists]` change with the *global* allowlist) showed the
  plural global form silently never suppresses anything — `.env.example`'s literal placeholder
  values kept showing up as findings even with a matching `paths` entry present. The correct
  global form is the **singular** `[allowlist]` (one table, not an array — confirmed against
  Gitleaks' own default config file); `[[allowlists]]` only exists nested under a specific
  `[[rules]]` block, to override the global allowlist for that one rule. Consolidated the three
  original blocks' `paths`/`regexes` into one `[allowlist]` table.

Both failures were completely invisible: both steps are wrapped in `|| true`, and the OSV step
additionally sets `continue-on-error: true` at the GitHub Actions level — so both jobs have shown
green ("pass") on every PR this entire session (and, per the file's evident age, likely long
before it) regardless of whether the tool ran at all. `gh run view --log` on the same run showed
Semgrep *did* run and found 79 current findings — surfaced only as a soft `::warning::`
annotation via `scripts/parse-semgrep-findings.py`, which also always exits 0 regardless of
count.

`SECURITY.md`'s "Dependency vulnerability policy" section states a severity-based triage table
("Critical/High with available fix → Blocking unless explicitly reviewed") in a way that could be
read as an automated CI gate. It is not — it never has been, independent of today's bug fix. This
is a real documentation-vs-reality gap in a security-governance document, worth correcting
regardless of the tooling fix.

## Decision

Fix only the two confirmed, unambiguous, mechanical bugs — not the larger, genuinely open
question of findings-governance policy (`PROGRAMME.md` §56's "scanner → normalized finding →
baseline → Matchboard security policy → pass/fail" progression, severity thresholds, an
exception/baseline mechanism, and triage of the 79 current Semgrep findings). That remains a real
product/security decision requiring explicit scoping, not something to bundle into a bug-fix PR —
same reasoning applied to Phase 8's §60 (left opportunistic) and this session's general pattern
of not unilaterally starting large policy work.

1. `security/osv-scanner.toml` rewritten as valid TOML using the real `[[IgnoredVulns]]` schema,
   preserving the existing `GO-2024-2687` exception and its reasoning/expiry (converted to the
   real `ignoreUntil` key, a native TOML date). Verified with Python's `tomllib` before shipping,
   since neither `osv-scanner` nor `gitleaks` binaries are available in this sandbox to run
   directly — the real, authoritative verification is the next live CI run on this PR (same
   "verify against real infrastructure" pattern this session has used throughout, e.g. PR #305's
   deploy pipeline, PR #310's Playwright specs).
2. `.github/workflows/security.yml`'s Gitleaks step: `--config-path` → `--config`.
3. `SECURITY.md`: added a factual note that the triage table is currently human/agent-applied
   policy, not an automated CI gate, and that this is a tracked gap (this ADR), not silently
   unaddressed.

## Consequences

- OSV-Scanner and Gitleaks now, for the first time, actually produce real scan results in CI —
  confirmed on this PR's own live run, not assumed. OSV immediately surfaced real findings that
  were never visible before: `nanoid@3.3.16` (GHSA-2v37-7h3g-55p8, CVSS 8.2) and
  `uuid@8.3.2` (GHSA-w5hq-g745-h8pq, CVSS 7.5) in production dependencies, plus
  `deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx, CVSS 8.2) and `@babel/core@7.29.0`
  (GHSA-4x5r-pxfx-6jf8, CVSS 3.2) in devDependencies. Per `SECURITY.md`'s existing triage table
  and this repo's "evidence, not proof" rule, these need their own triage/remediation pass — not
  bundled into this PR, which is scoped to making the scanner run at all.
- Gitleaks: 27 findings remain against `main`'s current tree even with the corrected allowlist
  (down from 38 with the broken plural form). Every one was manually reviewed (locally, against a
  clean `git archive` checkout matching what CI actually scans — not the sandbox's full working
  tree, which also has `node_modules` CI never sees) and confirmed a false positive on
  Matchboard's own custom regex rules, not a real secret: test fixtures (`AUTH_SECRET =
  "test-secret"`, `"should-not-exist"`, 32-character placeholder strings satisfying a minimum-
  length check), shell-variable references rather than literal values
  (`AUTH_SECRET="$TEST_AGENT_AUTH_SECRET"`), and documentation/template connection strings
  (`postgresql://user:pass@host.neon.tech/db`). Zero real secrets. Left as noise for a future
  §56-adjacent allowlist-tuning pass, not fixed further here — this PR's scope is "the scanner
  runs and its config loads," not "zero false positives," and writing broader allowlist regexes
  carries its own risk of being too permissive if done hastily.
- Both jobs remain non-blocking (`|| true` / `continue-on-error`) after this fix — this PR makes
  the scanners real, it does not change whether their findings can fail CI. That's the §56
  question, deliberately left open here.
- §55 (CodeQL) needed no action — already resolved by ADR-0070 (maintainer decision, GitHub's
  public-repository code-scanning entitlement). `PROGRAMME.md`'s pinned §55 text ("do not enable
  CodeQL... only revisit if... explicit permission is obtained") is superseded by that later,
  more specific decision — noted here for anyone reading the pinned programme spec literally.
- §57 (SBOM) remains a real, entirely unstarted gap — no SBOM generation of any kind exists in
  this repo. Left for a separate decision (which maintained tool/action to adopt, and whether to
  wire it to a release/tag trigger as §57 asks, given no release automation currently exists
  either) — same reasoning as §56, not bundled into this bug-fix PR.
