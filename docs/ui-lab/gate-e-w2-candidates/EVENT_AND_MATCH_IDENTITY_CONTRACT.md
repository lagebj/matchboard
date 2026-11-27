# Gate E W2 — Event and Match Identity Contract (E02)

## Event identity

- The Event heading is the page's only `h1` (`TouchlinePageHeader`, the same component and the
  same "type · format · date · status" context line production renders). It is rendered outside
  the tab body and outside the selected-match context, so neither a tab change nor a match
  selection can replace it. Tested: component test (only one `h1`), Playwright (heading text after
  selection, tab switch and two browser Back steps).
- Event status (Draft/Finalised) appears only in the heading context line, the finalised banner and
  the "Event details" section. It is never used to classify a match (integrity assertion 17).

## Squad identity

- Every match resolves its squad through `eventSquadId` against the Event's own squad list; never
  through a team-name string. The squad name is the own-team line of the real `ScorebookMatchRow`
  (accent marker). At ≥600px (`medium`) that line shows the full name. Below 600px the shared row
  ellipsizes team names ("Fjel…"), which would make "Fjellsiden Blå" and "Fjellsiden Rød"
  indistinguishable — the first revision wrongly claimed the squad was named "at every width"
  (independent review M2). Each row now carries a UI-Lab-only identity line (below 600px only)
  that wraps the full "Squad v Opponent" text instead of truncating; Playwright asserts at 390 and
  320px that all nine lines are visible, untruncated (`scrollWidth ≤ clientWidth`, no ellipsis)
  and name the right squad. The shared row itself is unchanged (BLK-E02-08).
- An unresolvable `eventSquadId` would render "Unknown squad" (not production's generic "Squad");
  integrity assertion 2 guarantees none of the fixtures contains one.
- "Nordbyen FK" is the opponent of three MIXED matches (Blå 09:00, Rød 10:20, Rød 14:00). Tests prove
  each keeps its own id, squad and kickoff in the row and in the selected context.

## Match identity

- Identity is the Event match id. The same `MatchPresentation` object (built once by the real
  `buildMatchPresentation()`) renders the row in the timeline and the row at the top of the selected
  context — one visual identity, not a second template (XR-S01).
- A `match` value that is not a match of this Event (tested with `gate-e-w2-e02-other-event-m01`) is
  rejected with a visible status message; it is never shown under this Event's heading.

## Identity across lifecycle (XR-S01)

The three candidates are the same Event day at 08:00, 11:30 and 18:00 (`DATA_TRUTH_AND_FIXTURES.md`).
Every match keeps its id, squad, opponent and kickoff in all three; only lifecycle facts change.
The continuity match `gate-e-w2-e02-m06` (11:20 Fjellsiden Blå v Kvisten IL) is:

| Candidate | Row | Selected context state |
|---|---|---|
| UPCOMING (08:00) | LATER, "11:20 / SAT 13 MAR", Scheduled | "Scheduled" |
| MIXED (11:30) | LIVE kicker, "— —", LIVE trailer | "Live — reporting session active", "Continue live reporting" |
| COMPLETED (18:00) | 2–1, FT · Win | "Result recorded — report completed" |

Same `ScorebookMatchRow` template, same squad marker and names, same kickoff label; the emphasis
moves from kickoff → live reporting → result. Proof: `fixture-integrity.test.ts` (identity fields
equal across fixtures, lifecycle planning_open → live → done), Playwright "XR-S01" group (selected
context in each state), and the three `continuity-match-selected` captures per viewport/theme.

## Navigation and selection — what is real and what is directional

| Capability | Production status | In this candidate |
|---|---|---|
| Event Detail tabs via `?tab=` | REAL (`event-detail.tsx` `setActiveTab`) | Same URL authority; non-overview tab bodies are not reproduced and say so |
| Select one match on Event day | NOT IN PRODUCTION (timeline rows have no `href`) | DIRECTIONAL: row `href` = same page + `match=<eventMatchId>`, all other query values preserved |
| Selected-match context | NOT IN PRODUCTION | DIRECTIONAL `CONTEXT_INSPECTOR` (aside on desktop ≥1200px, below the timeline on mobile) |
| Return to Event day | — | "Back to event day" clears only `match`; focus returns to that match's row; browser Back steps through prior selections |
| Direct URL restore | — | Loading `?match=<id>` restores the selection without a click |
| Live Reporting for this match | REAL `/o/{org}/events/{eventId}/matches/{eventMatchId}/live` | Linked with production's own visibility rule (not cancelled, report not LOCKED) and canonical label |
| Follow Live | REAL `…/live/follow` | Linked when not cancelled (production rule) |
| Report / lineup / helpers | REAL, inline in the Matches tab, no per-match URL | Linked as `/o/{org}/events/{eventId}?tab=matches` — opens the tab, cannot open that match's panel (production has no anchor) |
| Event Match Detail page | DOES NOT EXIST | Not linked, not invented. Recorded as BLK-E02-02 |

The synthetic org slug `acme` follows the W1/Gate C precedent; with synthetic ids these real
routes reach the real unauthenticated auth boundary (`/signin`) in the UI Lab, verified in
`e2e/ui-lab-gate-e.spec.ts` for the live-reporting link. The header "Back" link keeps production's
own bare `/events` href (ARR-0035 residue, as in W1).

`match` is a UI-Lab-only parameter. It is not a production URL convention and must not be read as
one; adopting it (or a real Event Match Detail route) is a production decision outside this wave.

## Identity acceptance tests

| Required proof (spec §6.5) | Where |
|---|---|
| Selecting a Rød match never shows Blå's identity | `pages.test.tsx` (direct URL), `event-day-projection.test.ts`, Playwright "selecting a Rød match…" |
| Same opponent, different ids stay distinct | `event-day-projection.test.ts` (three Nordbyen FK matches), Playwright "same-opponent matches stay distinct" |
| Change selection and return to Event | Playwright "browser Back restores…", "'Back to event day'…" |
| Direct URL restoration | `pages.test.tsx`, Playwright "a directly-loaded URL…" |
| Foreign match id is not re-parented | `event-day-projection.test.ts`, `pages.test.tsx`, Playwright |
