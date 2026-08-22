# Performance Targets

Matchboard does not yet have enough production traffic to derive its own historical
performance baseline. This document sets targets from published, general-purpose web
performance standards instead of app-specific measured numbers, and records what
Matchboard already does (or doesn't yet do) against them. Treat these as thresholds to
measure against once `@vercel/speed-insights` (already installed, see `src/app/layout.tsx`)
has accumulated real user data — not as numbers already confirmed to be met.

## Core Web Vitals targets (Google's published "good" thresholds)

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s | 2.5s–4s | > 4s |
| INP (Interaction to Next Paint) | ≤ 200ms | 200ms–500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |

These are the standard thresholds web.dev/Google publish for any web application, not
Matchboard-specific measurements. `web-vitals` reporting already flows through
`@vercel/speed-insights` in production; the Vercel dashboard is the source of truth once
there's enough real traffic to be statistically meaningful — do not treat a single session
or synthetic Lighthouse run as a substitute for real-user field data.

## What Matchboard already does that helps

- `next/font` (Geist Sans/Mono) — avoids render-blocking external font requests and
  layout shift from font swapping (`src/app/layout.tsx`).
- `reactCompiler: true` (`next.config.ts`) — automatic memoization, reduces unnecessary
  re-renders without hand-written `useMemo`/`useCallback` everywhere.
- Next.js App Router's per-route code splitting — `/simulation` and `/workbench` (the two
  admin-only, low-traffic routes) already ship as separate route bundles by construction;
  no additional `next/dynamic` splitting is needed for route-level isolation.
- `prefers-reduced-motion` handling in `globals.css` — avoids unnecessary animation work
  for users who've opted out at the OS level.

## What was found and fixed this pass

- **`BrandIllustration` fetched both light and dark image variants on every render**,
  even though only one was ever visible (`dark:hidden`/`hidden dark:block` CSS classes on
  two separate `<img>` tags). A browser fetches an `<img>` the moment its `src` is set,
  regardless of `display: none` — this is a well-documented light/dark image-swap pitfall,
  not specific to this app. Fixed by switching to a single `<picture>` element with a
  `<source media="(prefers-color-scheme: dark)">` — the browser now negotiates which one
  variant to actually request, halving image bytes downloaded on any page using brand
  illustrations. See `src/components/ui/brand-illustration.tsx`.

## What's known but not fixed in this pass

- `BrandIllustrationBackground` (`src/components/ui/brand-illustration.tsx`) has the same
  two-variant shape, but as CSS `background-image` on `display:none`-toggled `div`s rather
  than `<img>` tags. Browser behavior for whether a hidden element's CSS background-image
  is actually fetched is less consistent/well-documented across engines than the `<img>`
  case above, so this wasn't changed without being able to verify the fix actually helps.
  Revisit if Speed Insights ever flags real-world image transfer size as a problem on pages
  using it.
- No bundle-size analysis has been run. `motion` (used by `player-magnet.tsx`,
  `match-ticket.tsx`) ships on the Fixtures route's bundle; whether its tree-shaken size is
  actually a problem is unmeasured. Do not guess at further changes here without evidence —
  fix what Speed Insights/a real bundle analyzer actually shows once there's enough
  traffic/signal to act on, not what seems plausible in the abstract.

## Review cadence

Revisit this document once `@vercel/speed-insights` has accumulated enough real-user
sessions to report field data with confidence (Vercel's dashboard shows this directly).
Until then, treat any single-session or synthetic measurement as anecdotal, not a
baseline.
