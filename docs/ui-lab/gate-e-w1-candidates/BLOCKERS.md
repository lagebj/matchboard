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

### BLK-E01-04 — CI's first real Gate E Playwright run found two real test-authoring defects (fixed, not a production bug)

Confirming BLK-E01-02's prediction that local Playwright verification was unreliable in this
sandbox: this PR's first real CI run of `ui-lab-visual-review.yml` (run 45801842024) genuinely
failed 4 of 14 `e2e/ui-lab-gate-e.spec.ts` tests. Root-caused directly from the CI run's own page
snapshots and error logs (not guessed):

1. `page.getByLabel("League season")` is accessibility-tree-wide in Playwright (unlike
   `@testing-library/react`'s `getByLabelText`, which is scoped to form-labelable elements — this
   is exactly why the equivalent jsdom component tests never caught it) and matched **two**
   elements: the real `<select>` and `LeagueSeasonRail`'s unrelated
   `role="list" aria-label="League season weeks"` region. Every period-switching `selectOption()`
   call threw a strict-mode violation before ever changing the season, which is why the
   "re-resolves focus"/"restores current-round identity" assertions downstream also failed.
2. Playwright's `getByText(string)` substring-matches **case-insensitively** by default. Each
   candidate page's own debug subheading (`"...current round"` / `"...no current round"`)
   accidentally self-matched `getByText("Current round")` — including in the season-closed
   state's own XR-T01 reject-case test, which is exactly the assertion this wave most needs to be
   trustworthy.

Fixed in commit `0854cf9a`: every `getByLabel("League season")` replaced with the unambiguous
`getByRole("combobox", { name: "League season" })`; both subheadings renamed to "Mid-season
state" / "Season closed state". **No production code was touched** — `buildLeagueOperatingViewModel()`
and `LeagueSurface` were never in question; this was entirely a test-locator-precision defect in
`e2e/ui-lab-gate-e.spec.ts` itself. Re-run pending; this entry is not rewritten once that
succeeds — see `REVIEW_RECORD.md` for the final disposition.

No confirmed BLOCKING or MAJOR item remains unaddressed for E01. See `REVIEW_RECORD.md` for the
independent review's own findings.
