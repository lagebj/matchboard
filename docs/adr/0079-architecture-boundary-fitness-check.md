# ADR-0079: Architecture boundary fitness check (Phase 8 §59)

## Status

Accepted

## Date

2026-08-20

## Context

The consolidation programme's Phase 8 (`PROGRAMME.md` §58-62) targets a dependency direction —
`Next.js/UI → application services → domain policies → repository interfaces → infrastructure` —
where domain/policy code never imports Next.js, cookies, Brevo, Vercel, or browser APIs directly
(§58), and asks for that direction to be enforced once established (§59: "prefer lightweight
maintained tooling or repository checks... do not build an architecture framework merely to
enforce architecture").

An audit against §58-62 (recorded in `.matchboard-work/consolidation-programme/PHASES.md`'s
Phase 8 section — local execution memory, not committed to this repo) found: `src/lib/selection/`,
`src/lib/policies/`, `src/lib/rules/`, `src/lib/groups/`, and `src/domain/team-composition/`
already hold to §58's direction — zero Next.js/Brevo/Vercel imports found by grep — but **only by
convention**. No tooling enforced it; the next change could add a `next/headers` import to
`selection-eligibility.ts` with nothing catching it before review. This is §59's real, unstarted
gap — the one Phase 8 item that was genuinely open, versus §60-62 which were already
substantially satisfied by architecture that predates this programme.

`src/lib/` as a whole is not purely domain code — `src/lib/auth/` and `src/lib/seasons/` contain
legitimate `next/navigation`/`next/cache`/`next/headers` usage (redirects, cache revalidation),
confirmed by grep before scoping this check. Only the specific subdirectories AGENTS.md already
documents as the pure domain/policy layer are in scope.

## Decision

Add `scripts/check-architecture-boundaries.mjs`, following the exact pattern of
`scripts/check-terminology.mjs`/`scripts/check-docs.mjs`: a plain Node script, no new dependency,
regex-based import-specifier scanning (not a full AST parse — consistent with this repo's other
check scripts, and sufficient for flagging `import ... from "next/..."`/`require("next/...")`
without false-positiving on `vi.mock("next/navigation", ...)` string arguments, which aren't
`import`/`require` statements).

Scanned directories (`SCANNED_DIRS`, deliberately explicit, not "all of `src/lib`"):
`src/lib/selection`, `src/lib/policies`, `src/lib/rules`, `src/lib/groups`,
`src/domain/team-composition`. Widen this list only when a new directory is genuinely added to
the domain/policy layer — an implicit "scan everything" rule would either false-positive on
legitimate application-service code (as `src/lib/auth`/`src/lib/seasons` would) or silently stop
meaning anything as exceptions accumulate.

Forbidden import specifiers: `next` (exact), `next/*` (prefix), `@getbrevo/brevo`, `@vercel/*`.
Test files (`*.test.ts(x)`, `__tests__/`) are excluded — they're not part of what ships, and
mocking Next.js APIs in tests is normal practice this check has no reason to constrain.

One documented exception: `src/domain/team-composition/league-team-adapter.ts` — AGENTS.md's own
"Team composition engine files" table already labels this file "Application service", the one
file in this subtree that's deliberately the adapter layer, not domain policy code.

Wired into `npm run validate` only (`package.json`), as `npm run architecture:check` — the same
treatment `docs:check`/`terminology:check` already get. Not added as a separate CI job:
`.github/workflows/ci-checks.yml` currently runs `typecheck`/`lint`/`security-check-sql`/
`security-check-supply-chain`/`version-verify`/`test`/`build` as discrete named jobs, but not
`docs:check` or `terminology:check` — adding a dedicated CI job for this one check while those
established checks still aren't would be an inconsistent, out-of-scope expansion beyond what this
change set asks for.

## Consequences

- The dependency-direction invariant §58 already held by convention is now checked, not just
  assumed, whenever `npm run validate` runs (which the mandatory coding-agent workflow already
  requires before completion).
- Not enforced automatically in CI yet — same gap `docs:check`/`terminology:check` already have.
  If that gap is ever closed for those two, this check should move with them, not separately.
- §60's one found duplication (the inlined "active && !removedAt" player predicate across three
  eligibility modules) and §61/§62 (already satisfied) needed no code change from this ADR — see
  the Phase 8 audit for the full picture; this ADR covers §59 only.
