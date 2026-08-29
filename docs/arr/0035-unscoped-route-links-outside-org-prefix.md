# ARR-0035: Unscoped internal route links remain outside the org-prefixed routing model

## State

Open (partially resolved)

## Identified

2026-08-29, while investigating background HTTP traffic captured in Vercel runtime logs during
an E2E CI run (`fix/rounds-page-resilience-and-org-scoped-routing`, PR #376). Requests to
unscoped routes like `GET /rounds/{id}` appeared interleaved with expected `/o/{orgSlug}/...`
traffic; tracing them back to source found `Link`/`Button as="a"` elements still building hrefs
from a bare `/rounds/...`, `/players/...`, `/teams/...`, `/matches/...`, `/opponents/...` path
instead of routing through `useOrgUrl()`.

## Residue

ADR-0048 established `/o/{orgSlug}/...` as the authoritative route shape, with unscoped legacy
routes kept alive only as thin `redirectToOrgSlug()` shims for backward compatibility (deep
links, bookmarks, external references) — not as a shape any in-app navigation should still
target. `round-list-client.tsx` was already fixed for this in an earlier pass, but that fix was
never generalized into a lint rule, shared audit, or codemod, so new and existing components kept
constructing raw unscoped hrefs.

Every such link still *works* — the target page/route always resolves via its `redirectToOrgSlug()`
shim, so this was never a 404 risk — but each click costs an extra server round-trip, and Next.js's
default `<Link>` prefetching fires a background request to the unscoped route (which itself
issues a redirect) the moment the link scrolls into view, not only on click. This is exactly the
"Next.js `<Link>` prefetch storm" class of issue already found and fixed once in
`round-list-client.tsx` — confirmed to be a real, non-trivial source of background load, not a
theoretical concern.

## Scope found (2026-08-29 audit)

Fixed in this pass (files this branch already touches conceptually — rounds/team/match detail):

- `src/components/matches/match-detail.tsx` — 7 links (live reporting, follow live, player,
  post-match, review, opponent, round)
- `src/components/team/team-detail.tsx` — 9 links (round warnings, movement history player/round,
  history round, player squad list ×4, previous/next team)
- `src/components/players/current-round-attention-table.tsx` — 5 links (player ×2, team, round
  board ×2)

**Not fixed — left as open residue**, found via the same audit (`grep -rniE` for
`href={\`/[a-z]` / `href="/[a-z]"` across `src/components` and `src/app`, excluding
`orgUrl(...)`-wrapped and `/o/`/`/api/`/`/docs/`-prefixed matches):

- `src/components/assistant/team-readiness-card.tsx`, `post-match-page.tsx`
- `src/components/players/player-squad-context-panel.tsx`, `player-current-involvement-panel.tsx`,
  `manage-base-groups-view.tsx`, `season-overview-table.tsx`, `player-profile-header.tsx`,
  `player-table.tsx`
- `src/components/opponents/previous-encounters-display.tsx`, `previous-encounters-panel.tsx`
- `src/components/matches/match-tactics-panel.tsx`
- `src/components/history/history-table.tsx`, `movement-overview.tsx`
- `src/components/teams/team-table.tsx`
- `src/components/fixtures/fixtures-page.tsx`
- Several `src/app/(app)/insights/**/*-client.tsx` files (self-links back to `/insights`)
- `src/app/(app)/o/[orgSlug]/opponents/[opponentTeamId]/page.tsx`,
  `src/app/(app)/events/[eventId]/event-matches-tab.tsx`, `event-detail.tsx`

Roughly 25 more files carry the same pattern. This is a genuinely large, cross-cutting sweep —
deliberately not attempted in the same change that found it, to avoid turning a targeted CI
investigation into an unreviewed, unrelated-scope rewrite of navigation across the app.

## Intended architecture

Every in-app `Link`/`Button as="a"` href to an org-scoped page is built via `useOrgUrl()`
(`src/components/shell/org-slug-context.tsx`), never a bare unscoped path. Unscoped routes exist
only as `redirectToOrgSlug()` shims for external/legacy entry points, never as an internal
navigation target.

## Resolution criteria

- [ ] Every remaining file listed above converted to build its internal hrefs through
  `useOrgUrl()` (or an equivalent server-side org-prefixing helper for server components).
- [ ] A repeatable check (lint rule, `architecture:check` addition, or a standing grep-based test
  in `security-audit.test.ts`'s style) exists so a new unscoped internal href is caught before
  merge, not found again by manually re-running the same `grep` used to identify this ARR.
- [ ] No internal `Link`/`Button as="a"` in `src/components/**` or `src/app/(app)/**` targets a
  bare unscoped path for a route that has an org-scoped equivalent.

## Related decisions

ADR-0048 (OrgSlug-authoritative route migration) — the intended architecture this ARR's residue
falls short of.

## Related implementation

- `src/components/shell/org-slug-context.tsx` (`useOrgUrl()` — the existing, correct pattern)
- `src/components/matches/match-detail.tsx`, `src/components/team/team-detail.tsx`,
  `src/components/players/current-round-attention-table.tsx` (fixed in this pass)
- File list above (open)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-29

Identified and partially resolved while investigating CI background traffic during PR #376's E2E
runs. The three files most relevant to that branch's own existing scope (rounds/team/match
detail) were fixed and verified (lint, typecheck, component test suite all green). A broader
`grep`-based audit found the same pattern in ~25 more files across the app; recorded here as open
residue rather than fixed in the same change, since a full sweep is independent, unrelated-scope
work deserving its own reviewable change.
