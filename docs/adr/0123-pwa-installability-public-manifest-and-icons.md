# ADR-0123: PWA Installability — Public Manifest & Icons, Browser Owns Installation

## Status

Accepted. **Icon colours superseded by ADR-0136 Phase 8 (2026-09-12):** the brand-green
(`#144937`) + white-mark treatment this ADR established is now the Touchline accent (`#C7F54A`)
+ near-black-mark treatment (`scripts/generate-pwa-icons.sh`, AGENTS.md's "PWA (installable app)"
section) — the mark geometry, public-route/manifest architecture, and every other decision this
ADR records are unchanged and remain in force. This ADR's own body is left as the historical
record of the original colour choice, per this repository's append-only ADR convention.

## Context

Matchboard ships a Next.js App Router dynamic manifest (`src/app/manifest.ts`), an
`InstallPwaCard`, and the app-icon file conventions (`src/app/icon.png`,
`src/app/apple-icon.png`). It was declared "PWA v1 — implemented" by the
`ux-branding-language-ui` programme (Phase 2.10), but that work only unit-tested the manifest
*TypeScript object*. It was never verified in a real browser. In practice **no browser offered a
native install affordance** — not Edge/Chrome desktop, not Android — and the iOS home-screen icon
was broken.

Two root causes were confirmed from source and from the live deployments:

1. **The manifest and every icon asset were behind the authentication redirect.** `src/proxy.ts`'s
   matcher matches `/manifest.webmanifest`, `/brand/*`, `/icon.png`, `/apple-icon.png`; none were
   in `PUBLIC_ROUTES` (`src/lib/env.ts`). For any request without a session cookie the base gate
   (`src/proxy.ts`, `if (!email) redirect("/signin")`) returns `307 → /signin` (HTML). Verified
   live:

   ```
   GET https://app.matchboard.football/manifest.webmanifest  -> HTTP/2 307, location: /signin
   GET https://test.matchboard.football/manifest.webmanifest  -> HTTP/2 307, location: /signin, content-type: text/plain
   ```

2. **On production the manifest `<link>` is fetched without credentials.** Next only adds
   `crossOrigin="use-credentials"` to the auto-emitted `<link rel="manifest">` when
   `process.env.VERCEL_ENV === 'preview'`
   (`node_modules/next/dist/lib/metadata/metadata.js`). On `production` it is `undefined`, so the
   browser fetches `/manifest.webmanifest` anonymously → hits cause (1) → receives HTML →
   "manifest could not be parsed" → **not installable for any user, logged in or not**. On
   preview/test deployments it happens to work for already-logged-in users, which is why the gap
   was never caught.

Consequences: install-before-sign-in (the normal Spotify-style flow) is impossible; Lighthouse /
PWA validators / link unfurlers all fail; and even a signed-in coach's browser never satisfies
Chromium's installability criteria.

Secondary defects found during investigation:

- `src/app/apple-icon.png` was a transparent PNG with a dark line-art mark. iOS composites
  home-screen icons onto black → the mark was near-invisible.
- `manifest.ts` declared the full-bleed `android-chrome-*` PNGs `purpose: "maskable"`, but their
  mark runs to the edges and clips on circular Android masks.
- No `appleWebApp` / `mobile-web-app-capable` metadata, no `<meta name="theme-color">`, no
  `viewport-fit=cover` / safe-area handling.
- `install-prompt-card.tsx` called `e.preventDefault()` on `beforeinstallprompt`. This is not why
  desktop browsers showed no install control (it does not suppress the omnibox button), but it is
  interference and contradicts "the browser owns installation".

## Decision

**Browser-native installation is the primary path. Matchboard must not gate or suppress it.**

1. **`/manifest.webmanifest`, `/brand/**`, `/icon.png`, `/apple-icon.png` are public,
   unauthenticated routes.** Added to `PUBLIC_ROUTES` (`src/lib/env.ts`). This is a narrow,
   deliberate carve-out: the manifest is `name` / `start_url` / `icons` / colours, and
   `public/brand/**` is public branding artwork. None of it is tenant, player, match, or user
   data. `src/proxy.ts` still applies the standard security headers to these responses; only the
   auth redirect is skipped. Do not widen this set. Regression-guarded in
   `src/lib/__tests__/env.test.ts` and `src/test/security-audit.test.ts` (including an assertion
   that `manifest.ts` builds no DB/session query).

2. **The in-app `InstallPwaCard` is a discovery helper, not an installer.** It no longer calls
   `preventDefault()` on `beforeinstallprompt`. Its copy points at the browser's own control
   (address-bar install icon / browser menu). Where the browser hands over a deferred prompt it
   still offers a one-tap shortcut, and iOS still gets Share → Add to Home Screen instructions.
   Every non-installed state renders something actionable; once standalone display is detected it
   stops prompting.

3. **Corrective icon regen only** (`scripts/generate-pwa-icons.sh`, ImageMagick, not wired into
   the build — the committed PNGs are the deliverable). Same mark (`public/brand/logo.svg`), same
   brand green (`#144937`). `apple-icon.png` / `icon.png` become opaque; new
   `public/brand/maskable-{192,512}.png` keep the mark inside the centre-80% mask-safe area. The
   `android-chrome-{192,512}.png` `purpose: "any"` icons are unchanged. **No new brand-design
   decision** — this is technical packaging of the existing mark, distinct from the
   final-logo/app-icon owner-approval gate in `docs/product/brand-strategy.md`.

4. **HTML head metadata**: `src/app/layout.tsx` gains `export const viewport` (`themeColor`,
   `viewportFit: "cover"`), `metadata.applicationName`, `metadata.appleWebApp`
   (`capable` / `title` / `statusBarStyle: "default"`), and an explicit
   `apple-mobile-web-app-capable` for iOS < 16.4. The app shell adds
   `env(safe-area-inset-bottom)` padding to the fixed mobile nav and main scroll area.

5. **No service worker, no offline caching.** Modern Chromium does not require a service worker
   for installability; a valid public manifest + HTTPS + icons is sufficient. Matchboard holds
   authenticated, frequently-changing state (live match reporting) and must keep
   *installable shell + normal network semantics*, not offline-first. This is unchanged from the
   existing v1 boundary and does not affect ADR-0086's separate no-Web-Push decision.

6. **Automated regression**: `e2e/pwa-installability.spec.ts` (Playwright + Chrome DevTools
   Protocol) verifies the manifest is reachable unauthenticated, parses with no critical errors
   via `Page.getAppManifest`, every icon loads at its declared size, `Page.getInstallabilityErrors`
   reports nothing blocking, `start_url` resolves same-origin, and the effective display mode is
   `standalone`. The manifest unit test (`src/app/__tests__/manifest.test.ts`) is kept — it tests
   a different layer.

## Consequences

- The manifest and brand icons are served to anyone, authenticated or not. Accepted: they carry
  no sensitive data and are equivalent to what any visitor already sees on the sign-in / marketing
  page.
- Edge/Chrome desktop and Android Chrome/Edge now meet Chromium's installability criteria and
  surface their own install UI. iPhone Safari's Add to Home Screen uses the opaque green
  Matchboard icon and launches standalone at `/today`.
- A future custom Test-marker home-screen icon is still out of scope (the "Matchboard Test"
  `name`/`short_name` plus the in-app `TestEnvironmentBadge` remain the non-masquerade signals).
- Manual device acceptance (Windows Edge/Chrome, Android Chrome/Edge, iPhone Safari) is tracked in
  `docs/development/pwa-manual-verification.md` — the automated suite proves installability and
  non-interference; it cannot prove OS-level install/launch behaviour.

## Verification

- `GET /manifest.webmanifest` unauthenticated: `307 → /signin` (before) → `200
  application/manifest+json` (after), confirmed against a local production build.
- `Page.getInstallabilityErrors` via CDP: `(none)` against the local production build.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass.
- `npx playwright test pwa-installability` green.
