# Gate C W3 — Changed Files

## Production code

- `src/components/touchline/today/today-surface.tsx` — new optional `assistantCoachContext` prop
  (register C07 integration seam), omitted in production.
- `src/components/touchline/today/today-context-rail.tsx` — new optional `assistantCoach` render
  slot, appended after the existing fixed order.
- `src/components/touchline/today/today-assistant-coach-panel.tsx` — new. Maps the 5-state context
  to the real Assistant Coach presentation components.
- `src/lib/touchline/presentation/today-assistant-coach.ts` — new. The context type + visibility
  helper.
- `src/app/(app)/matches/league-match-guest-actions.ts` — added `requireMatchNotCancelled()` (real
  defect fix, register C08-D).
- `src/components/ai/assistant-coach-hypothesis-panel.tsx` — added `w-full min-w-0` to the
  development-focus `<input>` (real pre-existing layout defect, found by CI's real-browser
  Playwright run at 320px, see `REVIEW_RECORD.md` pass 2).
- `docs/adr/0151-match-day-roster-changes-and-operational-participation.md` — status corrected
  from "Proposed" to "Accepted"; status note recording the correction and the disclosed gap.

## Test infrastructure

- `src/test/setup-component.ts` — global mock for `assistant-coach-actions.ts` (jsdom/Vitest
  resolution fragility, see `REVIEW_RECORD.md` finding 1).

## New tests

- `src/app/(app)/matches/__tests__/league-match-guest-actions.test.ts` — new file, 10 tests
  (register C08-D, closes a pre-existing test-coverage gap).
- `src/app/(app)/o/[orgSlug]/today/__tests__/actions.test.ts` — one new test (TENTATIVE
  availability, register C08-B).

## UI Lab (dev-only, production-disabled)

- `src/app/dev/ui-lab/gate-c/w3-shared/{fixtures.ts,today-mount.tsx}` — new, this wave's own
  fixture directory (not shared with W1/W2, per issue #827).
- `src/app/dev/ui-lab/gate-c/c07-assistant-coach-fallback/{page.tsx,off/,on/,empty/,error/,stale/}`
  — new, 5 scenarios + index, each with `fixtures.ts`, `page.tsx`, `__tests__/fixtures.test.ts`,
  `__tests__/page.test.tsx`.
- `src/app/dev/ui-lab/gate-c/c08-same-day-quick-add/{page.tsx,planning-open/,after-availability-change/,planning-closed/}`
  — new, 3 scenarios + index (A/B/C only — see `BLOCKERS.md` for D/E).
- `src/app/dev/ui-lab/gate-c/page.tsx` — Gate C index updated to link C07/C08.
- `scripts/ui-lab-visual-review.mjs` — 8 new route registrations (`gcW3ExtraSmokeViewports` +
  5 C07 + 3 C08 entries), registered from the first commit per the established B5/R7 lesson.

## Documentation

- `docs/ui-lab/gate-c-w3-candidates/*` — this wave's full doc set (new directory).

## Version

- `package.json`, `package-lock.json`, `src/lib/version/index.ts` — PATCH bump, 0.169.13 →
  0.169.14 (`npm run version:patch`). Classification: the production-facing change is a real
  security/correctness fix (guest cancelled-match guard) plus dev-only UI Lab fixtures and CI
  tooling registration — no new user-facing feature, no domain-model change, no breaking change.
  Per `docs/VERSIONING.md`'s "mixed change sets use the highest applicable increment" rule, that
  is PATCH, not MINOR.

## Cleanup pass

No dead code, unused imports, or stale references found or introduced — confirmed via
`npm run lint` (clean) and `npm run typecheck` (clean). No routes or components were removed or
superseded by this wave.
