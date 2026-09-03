# ARR-0039: The extended Prisma client silently accepts an invalid `select` field at `tsc` time

## State

Contained (root-cause instance fixed; the general typing gap is not fixed)

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

- The one known instance is fixed (`matchType` instead of `type`, in both the `select` and the
  prop passthrough).
- No blanket fix applied to `src/lib/db.ts`'s extension typing in this pass — that would require
  either a stricter custom `select`/`where` type wrapper around every extended method (a
  significant, invasive change to a security-load-bearing file, ADR-0057/ADR-0087) or an
  ESLint/CI-time script that re-validates every `db.*` object literal's field names against
  `prisma/schema.prisma` (a real "docs alignment"/lint-rule style fix that has not been
  attempted or scoped here).

## Resolution criteria

Not yet defined for the general typing gap — this ARR stays "Contained" rather than "Resolved"
until either (a) the extended client's TypeScript types are verified to preserve full
excess-property strictness on `select`/`where`/`data`, or (b) an equivalent automated check
(lint rule, codemod-verifiable script, or a CI step that runs representative queries against a
real schema) is added and demonstrated to catch a reintroduced instance of this exact class of
bug.

## Disposition

Contained. The one confirmed instance is fixed and shipped. The systemic gap (extended Prisma
client typing weaker than the raw client's) is recorded here, not fixed — flagged for a future
decision on whether it is worth the investment given the codebase's otherwise-heavy reliance on
`db.ts` everywhere.

## Related decisions

ADR-0057 (introduced the `tenantRLS` extension), ADR-0087 (fail-closed tenant scoping on the
same extension), ADR-0112 (the Cloudflare Worker staleness this bug's CI failure masked/
conflated with — a separate, now-fixed problem)

## Related implementation

- `src/app/(app)/o/[orgSlug]/matches/[matchId]/live/follow/page.tsx` (the fix)
- `src/lib/db.ts` (the `tenantRLS` extension whose wrapping is the root cause of the weakened
  compile-time checking — not modified by this fix)

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
