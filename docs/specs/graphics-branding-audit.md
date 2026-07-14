# Spec: Graphics and Branding Integration Audit

## Objective

Verify that the Matchboard brand is wired into the app beyond favicons. Ensure logo appears in the app shell, illustrations appear in the correct empty states, and non-empty pages have appropriate but restrained brand presence.

## Audit checklist

### 1. App logo in shell

- [x] `MatchboardLogo` component exists using CSS mask on `/brand/logo.svg`
- [x] Sidebar uses `MatchboardLogo` at 28px, colored `var(--accent-strong)`
- [x] Sign-in page uses `MatchboardLogo` at 36px
- [x] Logo works in dark mode (uses `currentColor` via CSS mask)
- [ ] Verify logo renders visually in both light and dark mode (manual check)

### 2. Empty state illustrations

- [x] `BrandIllustration` component exists with light/dark switching
- [x] `EmptyState` component has `illustration` prop
- [x] Events page: `emptyEvents`
- [x] Fixtures page: `emptyMatches`
- [x] Teams page: `emptyPlayers`
- [x] Formations page: `emptyLineup`
- [x] Match detail (no squad): `emptyLineup`
- [x] Assistant (nothing urgent): `matchdayPrepSketch`
- [x] Post-match (no report): `emptyStats`
- [x] Event detail (no squads): `emptyEvents`
- [x] Players manage base groups: `emptyPlayers`
- [ ] Missing: Player list empty state — needs `emptyPlayers` where applicable
- [ ] Missing: History page empty state — needs `emptyStats`
- [ ] Missing: Season page empty state — needs `emptyStats`
- [ ] Missing: Round board empty state — needs `emptyLineup` where shown

### 3. Non-empty branding

- [x] Sign-in page has subtle report sketch background
- [ ] Assistant page: verify background illustration is visible but not dominant
- [ ] Event detail: could use `eventHeaderSketch` in the header area when event has room
- [ ] Player profile: consider `playerPlaceholder` in the header area (compact, not in lists)

### 4. Theme-aware rendering

- [x] `BrandIllustration` renders light variant in light mode, dark variant in dark mode
- [x] `BrandIllustrationBackground` renders light/dark backgrounds with appropriate opacity
- [ ] Manual verification: all empty states show correct image in both themes

### 5. Missing illustrations to add

Based on the audit, these empty states still need illustrations:

1. **History page** (`src/app/(app)/history/page.tsx`) — "No finalized history yet" → `emptyStats`
2. **Season page** (`src/app/(app)/season/page.tsx`) — if empty state exists → `emptyStats`
3. **Round board** — "No squad selections yet" already has `emptyLineup` via match-detail; verify round-level empty state

### 6. EPS file usage

- [ ] Verify no runtime code references `.eps` files
- [ ] Verify only `.webp` illustration files are imported/referenced in runtime code
- [x] `public/brand/logo.eps` exists but is not referenced in any code

### 7. Manifest and favicon

- [x] `src/app/favicon.ico` exists
- [x] `src/app/icon.png` exists
- [x] `src/app/apple-icon.png` exists
- [x] `public/brand/site.webmanifest` wired via `src/app/layout.tsx`
- [x] Manifest colors match app theme

## Changes needed

### A. Add `emptyStats` to History page empty state

The History page uses inline `<Surface>` elements for empty states. Convert to `EmptyState` component with illustration where appropriate.

### B. Verify Season page empty state

Check if the Season overview page has an empty state that should use `emptyStats`.

### C. Event detail header sketch

Add `eventHeaderSketch` illustration to event detail overview header when there is sufficient room (event has no squads or is in early setup). Do not add it above dense working views.

### D. Manual verification

After code changes:
- Run dev server
- Check logo in sidebar (light/dark mode)
- Check sign-in page (background illustration visible)
- Check each empty state page has the correct illustration
- Check non-empty pages are not over-decorated

## Commands

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Success Criteria

- Logo is visible in the main app shell (sidebar)
- Logo is theme-aware (renders correctly in light and dark)
- Empty states use the correct illustrations
- Non-empty pages have restrained brand presence
- Sign-in page background illustration renders
- No EPS files are referenced in runtime code
- Typecheck, lint, tests, and build pass