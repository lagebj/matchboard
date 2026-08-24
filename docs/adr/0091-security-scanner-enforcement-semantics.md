# ADR-0091: Explicit security scanner enforcement semantics

## Status

Accepted

## Date

2026-08-24

## Decision owners

- Matchboard engineering

## Context

AIP-0's baseline investigation (Architecture Integrity Programme, F-006) found the repository's
security scanners had inconsistent blocking semantics that were never explicitly decided or
documented as policy: `security:authz`, `security:check-sql`, and `security:check-supply-chain`
genuinely block CI on any violation, while Semgrep, OSV-Scanner, and Gitleaks all end their scan
invocation in `|| true` (OSV additionally sets `continue-on-error: true`) — findings never fail a
job regardless of severity or count.

ADR-0081 (fixing OSV/Gitleaks' broken CI invocations) explicitly deferred this exact question:
"the larger, genuinely open question of findings-governance policy... severity thresholds, an
exception/baseline mechanism... requires explicit scoping, not something to bundle into a bug-fix
PR." AIP-6 is that explicit scoping.

Re-verifying the current implementation for this phase (not trusting AIP-0's summary at face
value) found the blanket `|| true` pattern has a second, more serious consequence beyond "findings
don't block": it also swallows genuine **scanner execution failures** indistinguishably from
"scanner ran, found nothing." `scripts/parse-semgrep-findings.py`, the one place that already
tried to add a signal here, itself returned exit 0 ("success") when its input JSON file was
simply *missing* — exactly the state a crashed Semgrep invocation would leave behind. This is not
hypothetical: ADR-0081's own investigation found OSV-Scanner and Gitleaks had been silently
non-functional in CI for an extended period (a TOML syntax bug, a renamed CLI flag) with zero
failed checks ever surfacing it, precisely because nothing distinguished "didn't run" from "ran
clean."

## Decision

### Four explicit result classes

Documented in `SECURITY.md`'s new "Scanner execution vs. findings" section:

1. **Execution failure** (scanner crashed/misconfigured/never ran) — always blocks.
2. **Blocking check** (a specific, deterministic Matchboard invariant — SQL methods, Action
   pinning, authz test suite) — blocks on any violation, unchanged from today.
3. **Advisory finding** (Semgrep/OSV/Gitleaks ran successfully and reported N findings) — does
   not block; surfaced as a `::warning::` annotation for human/agent triage.
4. **Platform-managed** (CodeQL, via GitHub's hosted default setup, ADR-0070) — governed outside
   this repo's scripts entirely.

### `scripts/check-scanner-execution.mjs` — the one place class 1 vs. class 3 is decided

A new, tool-agnostic Node script wired into `.github/workflows/security.yml`'s `semgrep`,
`dependency-scan`, and `secret-scan` jobs, and into the equivalent local
`npm run security:semgrep`/`security:deps`/`security:secrets`/`security:secrets:history`
commands (keeping local and CI behavior identical). After each scanner runs (still `|| true` on
its own findings-related exit code — that part of the policy is unchanged), the checker verifies
the scanner wrote a **valid, parseable JSON output file**. This is deliberately schema-agnostic:
it does not attempt to parse each tool's internal finding structure for the pass/fail decision
(Semgrep, OSV-Scanner, and Gitleaks each use a different shape, and none of those binaries were
available in this environment to verify assumptions against with full confidence) — a
missing-or-unparseable file is reliable, tool-independent evidence of a real execution failure,
since every one of these tools writes its output file unconditionally, with an empty
results array, on a normal completed run with zero findings. Finding *count* is extracted
best-effort for the informational `::warning::` message only, never for the exit code — an
unrecognized JSON shape still passes (the file existing and parsing as JSON is the actual success
signal) with an "unknown" count rather than failing.

Verified against real tool output during this phase (not merely designed on paper): `osv-scanner`
and `gitleaks` were both available in this session's environment, and `npm run security:deps`
was run for real, correctly parsing a live 7-finding OSV result. Semgrep was unavailable locally;
its parsing path is covered by `src/test/check-scanner-execution.test.ts`'s unit tests instead,
using fixture JSON matching Semgrep's documented `--json` output shape (`{"results": [...]}`).

### Findings remain advisory-only — a deliberate non-decision, not an oversight

This ADR does **not** make Semgrep/OSV/Gitleaks findings block CI. Building real severity-based
blocking would need a finding-normalization and baseline/waiver-tracking layer to avoid a single
new low-severity finding blocking an unrelated PR — genuinely more machinery than this phase's
evidenced scope justifies, and exactly the kind of premature abstraction AGENTS.md's "no
speculative abstraction" principle warns against. `SECURITY.md`'s existing severity/action triage
table (Critical/High-with-fix → "blocking unless explicitly reviewed", etc.) remains the
human/agent-applied policy it already was — now explicitly labeled as such, not implied to be an
automated gate.

### Suppression/waiver formats — documented, not reinvented

Each tool already has its own native waiver mechanism (OSV's `[[IgnoredVulns]]` with
`ignoreUntil`, Gitleaks' `[allowlist]`, Semgrep's inline `// nosemgrep:`) — `SECURITY.md` now
documents all three explicitly as the house format, rather than the repository inventing a
fourth, parallel suppression concept layered on top.

## Rationale

- Distinguishing "the tool didn't run" from "the tool ran and found nothing" is the one part of
  this decision that has zero downside and directly addresses a failure mode that has already
  bitten this repository once (ADR-0081) — worth fixing regardless of the harder findings-severity
  question.
- Keeping findings advisory-only is the responsible default until a baseline/waiver-tracking
  mechanism exists — flipping to blocking today would immediately fail CI on the ~7 currently
  known OSV findings and the Semgrep findings from ADR-0081's own investigation, none of which
  have been triaged as part of this phase's evidenced scope, and doing so under this phase's time
  budget would be exactly the "opportunistic feature work" AGENTS.md's standing policy warns
  against.
- Schema-agnostic file-validity checking (rather than tool-specific finding-count parsing) avoids
  a real, concrete risk this phase directly encountered: an incorrect schema assumption for a
  tool with no local binary to verify against would make the checker itself unreliable — exactly
  the class of bug ADR-0081 already found once (a guessed CLI flag that didn't exist). Where a
  binary *was* available (OSV-Scanner, Gitleaks), the design was verified against real output
  before being trusted.

## Alternatives considered

### Make OSV/Gitleaks/Semgrep blocking on any finding

- Benefits: strongest enforcement
- Costs: immediately fails CI on every PR given ~7+ pre-existing, untriaged findings; no
  suppression/baseline mechanism exists yet to distinguish "known, accepted" from "new, unreviewed"
- Reason not selected: premature given current state; the right sequencing is baseline first,
  blocking second — not attempted in this phase

### Make findings blocking only above a severity threshold (e.g. Critical/High)

- Benefits: closer to `SECURITY.md`'s existing documented triage table
- Costs: still requires parsing each tool's severity field correctly per schema (the same
  unverified-schema risk this ADR explicitly avoided elsewhere), and still has no answer for the
  already-known, already-accepted-risk High findings from ADR-0081's triage (`deepmerge-ts`,
  `uuid`) without a waiver-recognition mechanism wired into the blocking check itself
- Reason not selected: same sequencing problem as above, plus the added schema risk

### Build a full baseline/waiver-tracking system now

- Benefits: would unblock true severity-based blocking in this same phase
- Costs: substantial new scope (a baseline file format, a review/expiry mechanism, updates to
  three tool configs) well beyond "the smallest useful boundary change" the Architecture
  Integrity Programme's specs consistently ask for
- Reason not selected: each tool's *existing* native waiver mechanism (documented, not rebuilt)
  is sufficient evidence a house format doesn't need inventing from scratch; revisit only if this
  proves insufficient once findings-blocking is actually pursued

## Consequences

### Positive

- A scanner that silently stops running (the exact ADR-0081 failure mode) now fails CI instead of
  looking identical to a clean scan — verified against real tool output for OSV/Gitleaks, unit
  tested for all three including Semgrep.
- Local (`npm run security:*`) and CI (`security.yml`) scanner invocations now share identical
  execution-verification logic, removing one more place local/CI drift could recur.
- `SECURITY.md` now states the enforcement policy explicitly and accurately, replacing a
  paragraph that only said "this is a known gap" with the actual current, deliberate policy.

### Negative

- Findings-based blocking remains unimplemented — the "harder half" of this ADR's originally
  open question is still open, by design. Tracked here, not silently dropped.
- `scripts/parse-semgrep-findings.py` (the prior, narrower, Semgrep-only attempt at this same
  idea) is removed in favor of the unified script — a real behavior change for anyone who
  referenced it directly (none found; only `security.yml` called it, now updated).

### Risks and mitigations

- Risk: a future scanner integration reintroduces the same conflated `|| true` pattern instead of
  reusing `check-scanner-execution.mjs`. Mitigation: this ADR and `SECURITY.md`'s new section
  document the pattern to reuse; the script is generically named and tool-parameterized precisely
  so a fourth tool can add itself with a one-line `--tool <name>` case rather than reinventing the
  check.
- Risk: the schema-agnostic design under-reports finding counts for a tool whose real output shape
  doesn't match `check-scanner-execution.mjs`'s best-effort parsing. Mitigation: this only affects
  the informational count in the advisory message, never the pass/fail decision — a shape
  mismatch degrades gracefully to "Findings: unknown," not a false failure or false pass.

## Migration and compatibility

- No schema or data migration.
- `scripts/parse-semgrep-findings.py` removed (superseded).
- Existing severity/triage documentation in `SECURITY.md` (`Dependency vulnerability policy`,
  `Current OSV triage`) is unchanged in substance, only clarified as human/agent-applied policy.
- Rollback: revert `security.yml`, the four `package.json` security scripts, and
  `scripts/check-scanner-execution.mjs`'s removal; each scanner reverts to its prior `|| true`-only
  invocation.

## Related records

- ADRs: ADR-0081 (fixed the mechanical OSV/Gitleaks CI bugs; explicitly deferred this policy
  question — resolved here), ADR-0070 (CodeQL platform-managed status, unchanged)
- Implementation: `scripts/check-scanner-execution.mjs` (new), `src/test/check-scanner-execution.test.ts`
  (new), `.github/workflows/security.yml`, `package.json` (`security:semgrep`/`security:deps`/
  `security:secrets`/`security:secrets:history`), `SECURITY.md`,
  `scripts/parse-semgrep-findings.py` (removed)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-24

Record created. Architecture Integrity Programme AIP-6 (Security enforcement semantics).
