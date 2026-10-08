# Compatibility registry

Per ADR-0158 (`10-dead-code-compatibility.md`'s maintenance-gates requirement): every retained
compatibility mechanism must be centrally identifiable, with a stated purpose and removal
condition. This registry does not create new redirects; it documents the ones already shipped
(ADR-0157 Slice C8) and this programme's own known, in-progress deletion debt.

## Route redirects

All retired `/insights/*` sub-routes, `/history`, `/more`, and `/reviews` are thin server-component
pages that resolve a destination and `redirect()` — not full page/component trees.

| Old route | Canonical replacement | Reason retained | Implementation | Removal condition |
|---|---|---|---|---|
| `/insights` (hub) | Season Review Overview | Preserve old bookmarks/links | `src/app/(app)/insights/page.tsx` → `resolveRetiredInsightDestination` | Never — permanent redirect, like any renamed route. |
| `/insights/opportunity`, `/opportunity-quality`, `/opportunity-gap` | Round Board planning detail / Player Detail | Preserve old bookmarks/links | `src/lib/insights/retired-insight-redirects.ts` | Never. |
| `/insights/load` | Player Detail participation history | Preserve old bookmarks/links | same | Never. |
| `/insights/coverage` | Round Board planning readiness | Preserve old bookmarks/links | same | Never. |
| `/insights/position-exposure` | Player Detail Development/Evidence | Preserve old bookmarks/links | same | Never. |
| `/insights/player-pathways` | Player Detail Development | Preserve old bookmarks/links | same | Never. |
| `/insights/continuity` | League Review | Preserve old bookmarks/links | same | Never. |
| `/insights/match-phase-patterns` | Match Details post-match / League Review | Preserve old bookmarks/links | same | Never. |
| `/insights/player-combinations` | League Review fallback (no standalone destination; PAC-009) | Preserve old bookmarks/links | same | Never. |
| `/insights/planned-vs-actual` | Match Details post-match / League Review | Preserve old bookmarks/links | same | Never. |
| `/insights/policy-warnings`, `/conflicts` | Round Board / Today | Preserve old bookmarks/links | same | Never. |
| `/insights/operational-health` | Today (coach) / Admin (system) | Preserve old bookmarks/links | same | Never. |
| `/history` | Season Review Players tab | Preserve old bookmarks/links | `src/app/(app)/o/[orgSlug]/history/page.tsx` | Never. |
| `/more` | `/settings` | Preserve old bookmarks/links | `src/app/(app)/o/[orgSlug]/more/page.tsx` | Never. |
| `/reviews` | Today (pending) / originating football object (resolved history) | Preserve old bookmarks/links | `src/app/(app)/o/[orgSlug]/reviews/page.tsx` | Never. |
| `/formations` (list) | Match Tactics contextual formation drawer | Preserve old bookmarks/links until formation-library management is fully reachable from `MatchTacticsPanel` | `src/app/(app)/formations/*` | When no caller still links to the list route directly. |

A route redirect that needs only framework-level URL rewriting (no per-request destination logic
or query-param preservation) belongs in `vercel.ts`/Next.js config instead of a page component;
none of the routes above qualify today, since each preserves selected-entity query params through
destination-specific logic.

## Deliberately retained compatibility code

| Item | Reason retained | Implementation | Removal condition |
|---|---|---|---|
| `tactical-surface.tsx`'s deprecated `pitch`/`glow` no-op props | Callers from before Touchline (ADR-0130) may still pass them | `src/components/ui/tactical-surface.tsx` | When no caller passes either prop (mechanically verifiable by removing the props and running typecheck). |
| Historical "Product Surface 1.0" mentions in `globals.css`/`touchline.css`/`review-list-client.tsx`/`adaptive-interaction-design.md` | Explain supersession/historical token-naming; not an active instruction | listed in `scripts/check-legacy-visual-dependency.mjs`'s `ALLOWLIST` | Each entry is individually reviewed by the legacy-visual-dependency check; removed from the allowlist (and this table) if the file ever stops mentioning it. |

## Known deletion debt (ADR-0158 maintenance-gates slice)

`npm run deadcode:check` (Knip) currently identifies 50 genuinely-dead files (verified individually
during this slice — zero importers via Knip's full import-graph analysis, cross-checked by hand
for every ambiguous case). They are **not yet deleted**: an auto-mode permission denial
(`Irreversible Local Destruction`) blocked the bulk `git rm` in the session that built this gate.
`deadcode:check` is therefore deliberately not yet wired into `npm run validate` or CI (see the
comments at both wiring points) — doing so now would make every build fail on debt this slice
could not clear itself, which is a worse outcome than a gate that isn't enforced yet.

This is explicit, time-bound debt, not a permanent exception: run `npm run deadcode:check` to see
the current list, delete each file once confirmed, then wire the step into
`scripts/run-validate.mjs` and the `Lint` job in `.github/workflows/ci-checks.yml` (both already
contain a comment marking exactly where). Until that happens, this entry — not a knip.json
`ignore` entry — is this debt's single source of truth, per this registry's own "explicit
compatibility, not speculative" rule.

## Non-goals

This registry does not list every Knip-detected "unused export/type" finding (`npx knip` without
`deadcode:check`'s file-only filter) — those are noisier and not yet triaged; see
`scripts/check-deadcode.mjs`'s own doc comment for why only the `files` category is enforced.
