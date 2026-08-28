# ADR-0103: User Documentation Experience — Architecture

## Status

Accepted

## Context

Matchboard has no public user-facing documentation and no in-app contextual help. The
`user-documentation-experience` programme (`.matchboard-work/user-documentation-experience/`,
local/gitignored working bundle — see `PROGRAMME.md`, `DECISIONS.md`, `PHASES.md`,
`ACCEPTANCE.md`, `DEMO_UNIVERSE.md`, `DOCUMENTATION_MESSAGE.md`) starts only once
`evidence-driven-coaching-loop` is merged and green, since documentation must describe real,
implemented behaviour rather than anticipated behaviour.

This ADR is the Phase 0 ("preflight and architecture record") output. It exists because the
programme changes the public route/auth boundary, introduces a new durable content architecture,
and changes test strategy (a documentation screenshot pipeline) — all architecture-affecting per
AGENTS.md's ADR gate.

### Predecessor verification (2026-08-27)

Verified directly against repository state, not only local programme metadata:

- `evidence-driven-coaching-loop` (PR #361) is merged into `main` (commit `b25460c8`), followed by
  two hardening PRs (#362 "production consistency and correctness pass", #363 nested-interactive
  a11y fix) — both merged, `main` at `75d71fb0`.
- `main`'s `CI` workflow (typecheck, lint, unit/component tests, build, migration-from-zero,
  migration-upgrade-from-populated-state, security scans, and Browser Acceptance Tests) is green
  as of this ADR — confirmed by direct run inspection, not assumed. (The persistent Neon "test"
  branch backing Browser Acceptance Tests had drifted 14 migrations behind since PR #359's merge,
  causing every main-branch CI run to fail for two days; root-caused and fixed as part of this
  same work session — see the `test-db-migrate.yml` manual dispatch run and PR #363.)
- `features/matchboard.feature` contains substantial evidence-engine coverage (combination
  evidence, football observations, planned rotation, actual position timeline — 47 matching
  lines), confirming predecessor behaviour is represented in the behavioural source of truth, not
  only in code.
- Current stack matches the programme bundle's assumed baseline exactly: Next.js `16.3.1`, React
  `19.2.8`, Tailwind `^4`, `next-intl@^4.13.7`, Playwright already installed with a real Auth.js
  `test-agent` credentials flow (`e2e/auth.setup.ts`) and committed E2E conventions.

### Repository facts this decision depends on

- **Auth boundary is enforced by `src/middleware.ts`**, gated by `isPublicRoute(path)`
  (`src/lib/env.ts`), which checks a plain `PUBLIC_ROUTES` string-prefix array
  (`/api/auth`, `/_next`, `/favicon.ico`, `/robots.txt`, `/signin`, `/error`, `/api/health`,
  `/api/meta`, `/api/locale`). This is already the exact mechanism used to exempt the existing
  public `(auth)` route group from the global "redirect to `/signin` when no session" rule — it is
  the narrowest, already-proven extension point for a new public route, not a new auth pattern.
- **`next.config.ts`** wraps the Next config with `createNextIntlPlugin(...)` and sets
  `reactCompiler: true` and `outputFileTracingIncludes` for policy Wasm artifacts. Any docs
  plugin must compose with `withNextIntl`, not replace it.
- **No existing server-side "current time" abstraction exists.** `src/lib/date-utils.ts` and
  domain code call `new Date()`/`Date.now()` directly; `src/lib/live-match/match-clock.ts` is a
  narrow live-match-period clock, not a general seam. Phase 2 (deterministic documentation
  dataset) must introduce the smallest safe, production-disabled server-side time seam rather than
  assume one exists.
- **`scripts/check-docs.mjs`** currently validates plain Markdown only (relative links, prohibited
  temp-file naming, ADR supersession consistency, empty directories) — it has no concept of MDX
  frontmatter, screenshot manifests, or help-context targets yet. Phase 6 extends it; this
  programme does not build a second, parallel docs validator.
- **The command palette** (`src/lib/commands/registry.ts`) is a single typed
  `COMMAND_REGISTRY: CommandDefinition[]` resolved server-side against a real `ActorContext`
  (`src/app/api/command-palette/route.ts`). A Help entry point integrating with it (Phase 5) is a
  new command definition, not a competing command system.
- **Fumadocs compatibility, verified live via `npm view` (not assumed from training data):**
  `fumadocs-core@16.15.4` (peer: `next: '16.x.x'`, `react: '^19.2.0'`), `fumadocs-mdx@15.4.0`
  (peer: `next: '^15.3.0 || ^16.0.0'`, `react: '^19.2.0'`, requires
  `fumadocs-core: '^16.15.3'`), `fumadocs-ui@16.15.4` (peer: `next: '16.x.x'`,
  `react: '^19.2.0'`). All three match this repository's installed Next.js/React versions exactly.
  No material incompatibility found — D3/PROGRAMME.md §6's default choice of Fumadocs stands;
  exact versions to pin are re-verified at Phase 1 implementation time, not locked in this ADR.

## Decision

1. **Documentation framework: Fumadocs**, composed alongside `next-intl` in `next.config.ts`.
   Canonical content lives in a new `content/docs/**` MDX tree. No second hosted docs product, no
   CMS.

2. **Public route boundary: add `"/docs"` to `PUBLIC_ROUTES`** in `src/lib/env.ts`. This is the
   entire auth-boundary change — no middleware redesign, no new auth mode, no weakening of the
   existing "authenticated session required for everything else" default. `/docs/**` pages and any
   docs-only API/search route must not read tenant/player/match/user data; they read only the
   canonical MDX content tree.

3. **One canonical content source, two renderers.** Public `/docs/**` and the authenticated
   in-app Help drawer both render the same `content/docs/**` MDX — never a duplicated prose copy
   inside application components. The initial Help drawer implementation renders a same-origin
   compact `/docs/**` view inside the drawer (D8) rather than a second MDX rendering pipeline
   embedded directly in the app shell, to avoid a brittle client/server boundary; this is an
   adapter decision and does not permit a second content tree.

   **Implementation update (2026-08-28): drawer rendering fix.** Two real defects were found and
   fixed in the initial Help drawer implementation, not a change to decision 3 itself:
   - The drawer's `fixed inset-0` overlay was a DOM descendant of the app shell's `<header>`
     (`backdrop-blur-2xl`, i.e. `backdrop-filter`), which per the CSS spec establishes a new
     containing block for `position: fixed` descendants. The overlay was collapsing to the
     header's own ~52px box instead of the viewport on every screen size, on both the desktop
     (`sm:w-[440px]`) and full-width mobile layouts — the drawer never rendered correctly at all.
     Fixed by portalling the drawer to `document.body` (`react-dom`'s `createPortal`), the
     standard fix for this class of bug and the same reason Dialog/Sheet-style components
     elsewhere are normally portalled.
   - The drawer's iframe pointed at the same `/docs/**` path used by "Open full documentation",
     which renders the full `DocsLayout` (sidebar tree, top nav bar, search trigger). That chrome
     has nowhere useful to navigate inside a ~440px panel and was pure wasted vertical space
     stacked on top of the drawer's own header. Added a second, still same-origin, still
     `/docs/**`-scoped rendering mode, `/docs/embed/**` (`docs/[[...slug]]/layout.tsx` branches
     on `params.slug[0] === "embed"`, `page.tsx` strips that segment before resolving content) —
     same canonical MDX, same `source` loader, no second content tree, only a lighter chrome
     (`DocsPage`'s notebook-mode fallback via Fumadocs' own `useIsDocsLayout()` check, with
     breadcrumb/footer/TOC explicitly disabled). Internal cross-links inside MDX prose are
     authored against plain `/docs/**` paths; `embed-link.tsx` rewrites them to `/docs/embed/**`
     when rendered in embed mode so browsing cross-references stays inside the compact embed
     rather than reintroducing the full chrome mid-navigation. No changes were needed to
     `PUBLIC_ROUTES`, CSP's `frame-ancestors`, or the X-Frame-Options middleware check — all three
     already match on the `/docs/` prefix, which `/docs/embed/**` still satisfies, so the "do not
     widen this beyond /docs/**" boundary in AGENTS.md is preserved exactly, not relaxed.

4. **Screenshots are content assets, not visual-regression baselines.** Generated via Playwright
   `page.screenshot()`/element capture into `public/docs/screenshots/**`, referenced from MDX.
   Normal CI validates referential integrity (every referenced screenshot exists, manifest IDs/
   output paths are unique, no orphans) — never exact pixel/byte equality, which is separately
   owned by any existing visual-regression suite.

5. **Deterministic documentation dataset is a distinct seed profile**, not a repurposing of
   `scripts/seed-test-dataset.ts`'s generic E2E fixtures. It reuses lower-level seed
   factories/domain operations where practical (per AGENTS.md's "one owning implementation"
   invariant) but is seeded, generated, and screenshotted independently so E2E test data and
   documentation narrative data do not couple.

6. **Time determinism uses Playwright Clock for the browser and, if needed, a new minimal,
   production-disabled server-side time seam** (no existing seam to reuse — see repository facts
   above). Any such seam must never be controllable by a public request parameter, cookie, or
   header, and must be proven disabled in production by a test, matching the same posture as
   `BYPASS_AUTH` (AGENTS.md: "BYPASS_AUTH is a test-only mechanism explicitly rejected in
   production").

   **Implementation update (Phase 2, 2026-08-27):** no server-side time seam was added. The
   documentation dataset (`scripts/seed-docs-dataset.ts`) anchors every date to real "now" via
   relative offsets (e.g. a match `daysFromNow(-7)`) rather than a fixed calendar date, so the
   League season it produces reads as genuinely current on any capture date without needing
   server time to be frozen or overridden — PROGRAMME.md §10.2's "do not rewrite broad domain
   time handling solely for screenshots" argues against introducing one for this narrower need.
   Browser-side time for Playwright capture still uses a fixed locale/timezone
   (`scripts/docs-screenshots.ts`), which is sufficient on its own. This narrows, rather than
   reverses, decision 6: the seam remains available as a future option if a scenario is ever
   added that genuinely requires a fixed server-side "now" (e.g. a screenshot whose content
   depends on which day of the season it is), but none of the current scenarios do, so it was
   not built. A new ADR is required before adding one later, per AGENTS.md's "User documentation"
   section.

7. **Contextual Help is additive to the existing shell and command palette** — a new typed
   `HelpContextId` registry mapping stable semantic contexts to docs targets, a new command in
   `COMMAND_REGISTRY`, and a new drawer/sheet component. It does not change navigation structure,
   route groups, or the existing five primary nav destinations (Today/League/Events/Players/More).

## Consequences

- Matchboard gains a public, indexable, shareable documentation surface and an in-app Help
  surface from one content source, with the narrowest possible auth-boundary change (one string
  added to an existing allowlist array).
- A new content tree (`content/docs/**`), a new public route family (`/docs/**`), a new seed
  profile, and a new Playwright capture path are introduced — each is scoped and gated by the
  phase plan in `PHASES.md`; none is built in this ADR. A server-only time seam was anticipated
  as a possible addition but, per the Phase 2 implementation update above, was not needed and was
  not built.
- `scripts/check-docs.mjs` gains documentation-integrity responsibilities in Phase 6 rather than
  a parallel validator being created.
- No existing selection engine, evidence engine, or domain behaviour changes. This programme is
  purely additive documentation/presentation surface over already-shipped behaviour.

## Migration

None. No schema changes. `PUBLIC_ROUTES` gains two entries (`/docs`, `/api/search`); no other
runtime behaviour changes as part of this ADR. Subsequent phases each carry their own scoped
implementation and, where applicable, their own migration notes (the docs seed profile is
additive, not a migration).

## Supersedes

None. This is a new architectural surface with no conflicting prior ADR.
