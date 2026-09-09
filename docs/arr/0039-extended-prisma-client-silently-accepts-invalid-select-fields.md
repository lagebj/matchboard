# ARR-0039: `tsc` silently accepts an invalid `select`/`where`/`data` field in a multi-key `db.*` query

## State

Resolved — Consolidation Programme C3, 2026-09-09. The general gap is now closed by a static
check (`scripts/check-prisma-query-fields.mjs`, in `npm run validate` + CI job `Prisma Query
Fields`). See "Correction" and the 2026-09-09 History entry.

> **Correction (2026-09-09):** the original write-up below attributes the missed `tsc` error to
> `src/lib/db.ts`'s `tenantRLS` `.extends()` wrapper. That attribution is **wrong**. The
> behaviour reproduces **identically on the raw, un-extended `PrismaClient`**: it is a generic
> TypeScript + Prisma `SelectSubset<T, U>` limitation that stops applying excess-property
> checking to a *nested* `select`/`where`/`data` object once the query-args object literal has
> **two or more keys** (e.g. `where` + `select` together — exactly the Follow-live query shape).
> The single-key form (`{ select: {...} }` alone) *is* still rejected by `tsc`, on both clients.
> The `as unknown as PrismaClient` cast in `db.ts` is type-neutral — it hands callers the full
> generated method signatures. The original text is retained unedited below for history; treat
> its "extended client's generic type plumbing does not preserve … strictness" claim as
> superseded by this correction.

## Identified

2026-09-03, while investigating a recurring "Deploy PR to Test slot" / "Browser Acceptance
Tests" CI failure on `e2e/follow-live.spec.ts`. The failure's actual cause turned out to be a
runtime `PrismaClientValidationError` inside a Next.js Server Component, surfaced to the browser
as a generic digest-only "Something went wrong" boundary (React error #441 — "an error occurred
in the Server Components render") — not a Cloudflare Worker/environment issue, despite the
Worker also being independently stale (see the related finding recorded in
`docs/adr/0112-canonical-live-projection-and-per-pr-worker-deploy.md`'s History for that
separate, now-fixed problem).

## Residue

`src/app/(app)/o/[orgSlug]/matches/[matchId]/live/follow/page.tsx` (introduced by PR #401,
2026-09-03) selected a field that does not exist on the `Match` model:

```ts
const match = await db.match.findFirst({
  where: { id: matchId, ...ctx.orgFilter.filter },
  select: { id: true, opponent: true, homeAway: true, gameFormat: true, type: true, teamId: true, ... },
  //                                                                     ^^^^ should be matchType
});
// ...
<FollowLiveClient matchType={match.type} ... />  // should be match.matchType
```

`Match` has `matchType: MatchType`, never a plain `type` field. Confirmed directly against a real
database connection that Prisma throws at runtime for this exact shape:

```
PrismaClientValidationError: Invalid `prisma.match.findFirst()` invocation:
{ select: { id: true, type: true, ~~~~ ? organisationId?: true, ... } }
```

**This should have been a `tsc` compile error** — TypeScript performs excess-property checking
on object literals passed directly as arguments, and `type` is not a key of the generated
`Prisma.MatchSelect` type. It was not caught, in this repository specifically, because `db` in
`src/lib/db.ts` is not the raw generated Prisma client — it is wrapped via `.extends()` (the
`tenantRLS` extension, ADR-0057) for tenant isolation. Empirically confirmed: `npx tsc --noEmit`
passes cleanly on this file both before and after the fix, for both the correct field name and
the invalid one — the extended client's generic type plumbing does not preserve the same
excess-property strictness the raw generated client would have applied to the same object
literal. `npm run lint` also does not catch it (ESLint has no Prisma-schema-aware rule here).

This is a different failure mode from ARR-0029 (which was about the `tenantRLS` extension's
*runtime* where-clause-injection logic being inert). This finding is purely about *compile-time*
type safety being weaker on the wrapped client than on the raw one — a typo like this can ship,
pass every existing static check, and only surface as a production runtime crash the first time
a real request actually reaches that code path.

## Intended architecture

Wrapping the Prisma client via `.extends()` for tenant isolation was never intended to weaken
the compile-time guarantees the generated client already provides for `select`/`where`/`data`
shapes — AGENTS.md documents `db.ts` as a drop-in replacement for the raw client, used
identically everywhere in the codebase.

## Evidence

- Direct reproduction against `TEST_DATABASE_URL` using the raw generated client with the exact
  `{ id: true, type: true }` select shape: throws `PrismaClientValidationError` immediately.
- `npx tsc --noEmit -p tsconfig.json` across the whole `src/` tree: zero errors, both with the
  bug present and after the fix — confirming this specific invalid shape was never flagged by
  the project's own required `npm run typecheck` gate.
- `e2e/follow-live.spec.ts` (real browser, real Cloudflare Durable Object path) is the only
  layer of testing in the repository that actually renders this Server Component with a real
  database connection — no vitest unit/integration test exercises this page's data-fetching
  function, since Next.js Server Component page functions are not factored into independently
  testable units here.

## Impact

- **Production impact, not just CI noise.** `app.matchboard.football`'s real "Follow live"
  viewer route was broken for any coach who tried to use it from shortly after PR #401 merged
  (2026-09-03 ~05:23 UTC) until this fix. `Match` is a League-only model, so this affected only
  League matches' Follow Live viewer, not Event matches.
  every subsequent CI run on `main` (through PR #402/#404/#405) inherited the same failure,
  which — combined with `deploy-live-match-worker.yml`'s `workflow_run` gate requiring a
  *successful* CI conclusion — also stalled the Cloudflare Worker's automatic redeploy for both
  `test` and `production` environments (a second, independent, now-separately-resolved
  consequence; see ADR-0112's History).
- Confirms the general risk: any future `select`/`where`/`data` object literal passed to `db.*`
  with a typo'd or renamed-but-not-updated field name will not be caught by `tsc` or `lint`, and
  will only fail the first time a real request/test exercises that exact code path with a real
  database connection.

## Containment

- The original instance (`matchType` instead of `type`) was fixed on 2026-09-03.
- Resolution took approach (b) from the criteria below: a static, generated-type-aware check
  rather than a runtime-only guard, and without touching the security-load-bearing extension
  (there was nothing to fix there — see Correction).

## Resolution criteria

Met via option (b): an automated check that catches a reintroduced instance of this class of
bug, wired into the canonical quality gate.

## Disposition

Resolved. `scripts/check-prisma-query-fields.mjs` statically scans every
`<client>.<model>.<method>({...})` call in `src/`, extracts the explicitly-written keys of each
nested `select`/`include`/`where`/`data`/`orderBy`/`omit` object literal, and re-checks them by
direct assignment to the concrete generated `Prisma.<Model>Select` / `WhereInput` / `CreateInput`
etc. (direct assignment triggers excess-property checking regardless of key count). It runs in
`npm run validate` and as the CI job `Prisma Query Fields` (a `needs:` dependency of `build`).
Its first run found and fixed two further pre-existing instances of the same class
(`best-lineup.ts` querying `Availability.matchId`, which does not exist; the coach-handover page
selecting a non-existent `Match.warnings` relation). `src/lib/__tests__/prisma-query-field-safety.test-d.ts`
pins the single-key `tsc` protection and documents the multi-key boundary;
`scripts/__tests__/check-prisma-query-fields.test.ts` proves the static check catches a
reintroduced multi-key instance.

## Related decisions

ADR-0057 (introduced the `tenantRLS` extension), ADR-0087 (fail-closed tenant scoping on the
same extension), ADR-0112 (the Cloudflare Worker staleness this bug's CI failure masked/
conflated with — a separate, now-fixed problem)

## Related implementation

- `scripts/check-prisma-query-fields.mjs` — the static field-name check (resolution)
- `scripts/__tests__/check-prisma-query-fields.test.ts`,
  `src/lib/__tests__/prisma-query-field-safety.test-d.ts` — regression coverage
- `.github/workflows/ci-checks.yml` — `Prisma Query Fields` job
- `src/app/(app)/o/[orgSlug]/matches/[matchId]/live/follow/page.tsx` (the original 2026-09-03 fix)
- `src/lib/best-lineup/best-lineup.ts`,
  `src/app/(app)/o/[orgSlug]/matches/[matchId]/handover/page.tsx` (two further instances found and
  fixed by the check's first run)
- `src/lib/db.ts` (comment corrected — the wrapper is NOT the cause; not otherwise modified)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-03

Identified while investigating a user-reported "Deploy PR to Test slot fails every time now"
CI concern, alongside a separate, now-fixed finding that the Cloudflare Worker serving both
`test` and `production` environments had been stuck 11+ hours behind `main` because
`deploy-live-match-worker.yml`'s `workflow_run` gate requires CI to already be green — a
deadlock this same bug's CI failures were causing. Root-caused by reproducing the exact
`PrismaClientValidationError` directly against a real database connection rather than continuing
to reason from Playwright's generic error-boundary screenshot alone. Fixed in the same session;
this ARR records the general typing gap that let it ship silently.

### 2026-09-09

Resolved (Consolidation Programme C3). Re-verified the mechanism: the missed `tsc` error is a
generic Prisma `SelectSubset<T,U>` + TypeScript excess-property-check limitation for query-args
objects with 2+ keys, reproducing on the raw `PrismaClient` too — **not** caused by the
`tenantRLS` extension (see Correction). Closed the gap with `scripts/check-prisma-query-fields.mjs`
(static, generated-type-aware; `npm run validate` + CI job `Prisma Query Fields` gating `build`).
The check's first run surfaced two more pre-existing instances of the same class, both fixed:
`best-lineup.ts` filtering `db.availability.findMany({ where: { matchId } })` (`Availability` is
round-scoped, has no `matchId`), and the coach-handover page selecting a non-existent
`Match.warnings` relation (rewired to `computeRoundPlanIntegrity()`, the canonical live source).
Added `src/lib/__tests__/prisma-query-field-safety.test-d.ts` (compile-time canary) and
`scripts/__tests__/check-prisma-query-fields.test.ts` (proves the static check catches a
reintroduced multi-key instance). Corrected the `db.ts` cast comment.
