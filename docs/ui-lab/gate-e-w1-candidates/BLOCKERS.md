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

### BLK-E01-05 — independent review found the header was hand-rolled, not the real `TouchlinePageHeader` (fixed)

A fresh, context-independent review (not self-review; see `REVIEW_RECORD.md`) found that
`league-fixture-mount.tsx`'s original implementation hand-rolled its own `<h1>`/layout markup for
the League title/context/actions row instead of reusing the real, production
`TouchlinePageHeader`/`TouchlineButton` primitives `FixturesPage` actually uses — a genuine,
undisclosed divergence that directly contradicted this document set's own "zero new/directional
presentation" and "it does not... diverge from production behaviour in any way" claims (the
rendered title was 20px instead of production's real 28/32px, among other layout differences).
Classified **MAJOR** by the reviewer.

**Fixed**: the mount now imports and renders the real `TouchlinePageHeader`/`TouchlineButton`
exactly as `fixtures-page.tsx` does, including the real "Create match" navigation link (a plain
link to `/o/{orgSlug}/matches/new`, not a mutation, so it was safe to keep — only "Generate all
draft squads", a real Server Action, remains intentionally omitted). All local tests re-verified
green after the fix. See `CHANGED_FILES.md`/git history for the exact commit.

### BLK-E01-06 — a second, external review found real temporal-label and layout-fidelity defects (fixed)

A further review (external to this session) found six findings the first independent review had
missed:

1. **E01-R1 (MAJOR, fixed)** — several manually-authored display labels had drifted from the
   fixtures' own real dates: Round 6 was labelled "15 Feb 2027" against a real kickoff
   (`ANCHOR-21d`) of 22 Feb 2027; Spring 2027's `dateRange` said "Mar – Jun 2027" against real
   boundaries of Feb 15 – Apr 19 2027; the mid-season Autumn 2026 period's `dateRange` and two
   round labels were similarly off by three weeks; the season-closed fixture's only period was
   named "Autumn 2026" (and dated "Jan – Mar 2027") while its real boundaries fall entirely in
   January–February 2027. Every discrepancy was independently recomputed and confirmed with Node
   before editing anything. Fixed: every label corrected to its real date;
   `fixtureVersion` bumped 1 → 2 on both fixtures; `fixtureSha256` recomputed; the season-closed
   period renamed "Winter 2027" (id `...-period-winter-2027`); a new, independent reconciliation
   test layer (`fixture-temporal-integrity.test.ts`) added so a future kickoff edit without a
   matching label update fails mechanically rather than silently.
2. **E01-R2 (MAJOR, fixed)** — both candidate pages capped their actual League product surface at
   `max-w-[720px]`, materially narrower than the real app shell's `max-w-[96rem]`
   (`src/app/(app)/layout.tsx`), distorting the desktop composition's real density/spacing. Fixed:
   the product surface now uses the real `max-w-[96rem]` container; UI-Lab-only chrome (back link,
   appearance control, scenario label) stays at a narrower reading width, deliberately separated
   from the product surface; a real 1440px-viewport width assertion (`> 1200px`) was added to
   `e2e/ui-lab-gate-e.spec.ts`.
3. **E01-R3 (MINOR, fixed)** — `DATA_TRUTH_AND_FIXTURES.md` claimed "eleven matches"; the real
   count (independently asserted from the fixture records in the new reconciliation test) is ten
   (eight in Spring, two in Autumn).
4. **E01-R4 (MINOR, fixed)** — `INTERACTION_AND_STATE_AUDIT.md` and `WAVE_SCOPE.md` still claimed
   both "Generate all draft squads" and "Create match" were omitted; "Create match" is in fact
   rendered (a plain navigation link, not a mutation) — corrected everywhere this was stated.
5. **E01-R5 (MINOR, fixed)** — `VISUAL_VS_CURRENT.md` referenced a since-superseded CI run.
   Corrected to point at `capture-attestation.json` as the single current source of truth, with
   the full chain of superseded runs recorded rather than silently overwritten.
6. **E01-R6 (acceptance-language gap, fixed)** — "context restoration" in the acceptance question
   traces to XR-T01's own "back restores the selected context" text, a claim about real
   selected-context restoration (direct URL load, browser Back) — not about a period remembering a
   manually-selected round after switching away and back, which production does not implement.
   The existing tests only proved default-focus re-resolution. Fixed: `INTERACTION_AND_STATE_AUDIT.md`
   now states this distinction explicitly, and `e2e/ui-lab-gate-e.spec.ts` gained real tests for
   direct-URL round restoration, browser Back restoration, explicit confirmation that the `round`
   param is cleared (not merely unobserved) on period switch, and real keyboard-interaction tests
   (`ArrowRight`+`Enter` on the season rail, `ArrowDown` on the season `<select>`) — none of this
   invents a production capability that doesn't exist.

**Also investigated, found immaterial:** the external review noted a screenshot hash variation for
`gate-e-w1-e01-mid-season-current-round-mobile-dark.png` between two successful CI capture runs
(`45815450631` and `45823024629`) against byte-identical application code. Both PNGs were
downloaded and diffed pixel-by-pixel: the difference is a 178×258px region with a maximum
per-channel delta of 1 across 26 of 457,860 total pixels — sub-perceptual font-rasterization
jitter in headless Chromium, not a layout or content regression. Not re-investigated further; not
a blocker.

No confirmed BLOCKING or unaddressed MAJOR item remains for E01. See `REVIEW_RECORD.md` for the
full independent-review account across both rounds.
