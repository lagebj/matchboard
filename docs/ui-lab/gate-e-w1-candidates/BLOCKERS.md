# Gate E W1 — Blockers

## Resolved / not applicable

Unlike Gate D's D07/D08 at their outset, **no authority conflict, undecided domain policy, or
missing production capability blocks E01.** `buildLeagueOperatingViewModel()`/`LeagueSurface` are
already real, shipped, and sufficient.

## Open items (disclosed, not blocking)

### BLK-E01-01 — ARR-0035 residue surfaces, not fixed

`buildLeagueOperatingViewModel()`'s own `buildFocusedRound()` hardcodes bare unscoped hrefs
(`/matches/{id}`, `/rounds/{id}`). This is pre-existing, already-tracked residue
(ARR-0035, which already lists `fixtures-page.tsx` by name), not introduced by this wave. Fixing
it is out of scope here — ARR-0035's own resolution criteria call for a full cross-app sweep, not
a single-surface fix bundled into an unrelated UI Lab candidate PR. **Not blocking**: every such
link still resolves correctly via the existing `redirectToOrgSlug()` shim, verified by code
reading (`resolve-org-slug.ts` → `actor-context.ts` → `organisations/page.tsx` →
`/api/auth/signin`) and asserted in `e2e/ui-lab-gate-e.spec.ts`.

### BLK-E01-02 — Local Playwright verification blocked in this sandbox

This devcontainer's `next dev` cannot complete Playwright's hydration handshake (HMR WebSocket
upgrade loop), a pre-existing, already-documented sandbox limitation that reproduces on untouched
baseline pages too (prior-session finding, carried forward rather than re-discovered). The exact
redirect chain `e2e/ui-lab-gate-e.spec.ts` asserts (`/matches/{id}` → `/organisations` →
`/api/auth/signin`) was therefore verified by direct code reading in this session
(`src/lib/auth/redirect-to-org.ts`, `src/lib/auth/resolve-org-slug.ts`,
`src/lib/auth/actor-context.ts`, `src/app/(app)/organisations/page.tsx`), not by a local
Playwright run. **Not blocking**: CI's `ui-lab-visual-review.yml` runs the real Playwright suite
against a real `next dev` server in a real (non-devcontainer) environment, and this PR's own CI
run is the actual verification evidence — see `capture-attestation.json` once that run completes.
Also: a first attempt to start `next dev` locally in this sandbox was interrupted by Next.js's own
one-time interactive security-upgrade nudge (unrelated to Matchboard's tooling); this did not
block anything, since the real CI workflow starts `next dev` the identical way every prior Gate
A–D wave already relied on successfully.

### BLK-E01-03 — `fixtureSha256` values were computed, not hand-derived

Both fixtures' `identity.fixtureSha256` literals were produced by running the real
`createHash("sha256")` computation once (via the fixture's own test) and copying the result in —
consistent with every prior gate's own convention ("tests recompute, never copy" means the test
never trusts an arbitrary literal, not that a human never runs the computation once to seed it).
Not a blocker, recorded here only for transparency per the mission brief's "no premature
verification claims" standard.

No confirmed BLOCKING or MAJOR item exists for E01 at implementation time. See
`REVIEW_RECORD.md` for the independent review's own findings.
