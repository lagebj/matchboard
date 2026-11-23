# C08 — Operational Acceptance Report

Explicit PASS/PARTIAL/BLOCKED per required scenario and per sub-requirement, per the brief's
§11/§16 requirement. Revised after an external remediation review found the first version
overstated some dispositions — see `REVIEW_RECORD.md` pass 3 for the finding-by-finding record.

## Evidence-tier disclosure (read before the table)

Two genuinely different evidence tiers exist across this wave, and this report never blurs them:

- **Real-DB integration evidence** (`today/__tests__/actions.test.ts`,
  `league-match-guest-actions.test.ts`, pre-existing `match-helper-actions.test.ts`): exercises
  the real Server Action → real domain function → real Postgres persistence → real
  authorization/tenancy checks, against a disposable test database (`setupTestDb()`). This is
  genuine, strong evidence of correct server-side behavior — but it is not a browser click-through.
- **Authenticated browser-level evidence** (a real signed-in Playwright session driving the real
  UI, seeded match, reload, cross-page consistency check): **not produced in this wave.** This
  repo's one existing precedent for exactly this shape, `e2e/round-mutation.spec.ts`, is itself
  currently `test.skip()`-disabled — its own comment states the heavy multi-step seed endpoints
  it needs (create match → generate round → finalize/reopen) now consistently time out on Vercel
  serverless since the Next.js 16 proxy migration (Edge → Node runtime), and only ever ran
  locally. Building new, similarly-shaped seed infrastructure for C08 would carry the same risk;
  running it for real additionally requires the `acceptance` PR label (provisions a real Neon
  branch + Vercel Test-slot deployment — a deliberate, costly, explicit action, never an ordinary
  push side effect). Given this precedent, the repository owner explicitly chose to document the
  limitation rather than fund/risk building this infrastructure for this wave. **No browser-level
  evidence is claimed anywhere in this report**; where UI Lab fixture routes exist (C08-A/B/C),
  they are explicitly disclosed as **display-only**, not operational proof.

| Scenario | Requirement | Result | Evidence |
|---|---|---|---|
| C08-A — Planning open | Correct eligible-player options, accurate action availability, successful mutation, clear feedback, correct assignment, consistent state across Today/Round Board/Fixtures after reload | **PARTIAL** — server-side mutation and persistence: PASS. Authenticated browser journey: not produced (see disclosure above). | `today/__tests__/actions.test.ts`: "applies the mutation and revalidates Today/Round Board/Fixtures when the fingerprint matches current state" — real `Selection` row persisted, real `revalidatePath` calls to all three surfaces confirmed. `c08-same-day-quick-add/planning-open` is a **display-only** UI Lab fixture (its own `applyRecommendation` handler never mutates — see `GateCW3TodayMount`), not operational evidence. |
| C08-B — Tentative availability (register's "after RSVP" state) | RSVP closure not treated as equivalent to planning closure; existing availability rules remain authoritative | Official "after RSVP" requirement: **BLOCKED** — Matchboard has no automated RSVP-deadline mechanism at all (confirmed by code inspection: `PlannedAbsenceReason.NO_RSVP` is a manually-selected category, not a computed deadline). This scenario does **not** satisfy that requirement and is not labelled as if it did. Tentative-availability handling (a real, adjacent, separately-verified mechanism): **PASS**, as disclosed supplementary coverage only. | `today/__tests__/actions.test.ts`'s new TENTATIVE test: the plan-integrity signal still fires for a tentative player, and the recommendation correctly degrades with the real, distinct `unavailableReason` string — never conflated with a planning-closed message. No RSVP-deadline test exists or is claimed, because no such mechanism exists to test. |
| C08-C — Planning closed | Interface reflects true planning state; no misleading action offered; direct mutation attempts receive proper boundary validation | **PARTIAL** — server-side rejection: PASS. Authenticated browser journey: not produced. | `today/__tests__/actions.test.ts`: "rejects once the planning boundary is closed for the target match" — real `isPlanningBoundaryClosed()` check, no `Selection` row created. `c08-same-day-quick-add/planning-closed` is a **display-only** fixture. |
| C08-D — Guest | Guest eligibility; correct org/group scope; existing guest-player restrictions; appropriate squad display; no permanent roster membership | Server-side eligibility/scope/restrictions/squad-display/no-permanent-membership: **PASS**. Browser-level "open the real dialog, add a guest, see it in the squad" journey: **not produced** (same infra limitation). Live-event-recording participation: **BLOCKED** (issue #842, explicitly not implemented in this remediation per the brief's own boundary). | `league-match-guest-actions.test.ts` (10 tests): registration, emergency `skipRoundRegistration` add, new-guest creation, duplicate rejection, tenant isolation, cancelled-match rejection (real defect found and fixed in this wave), correct appearance in `getEffectiveLeagueMatchRoster()` (squad display), confirmed never becomes a `Player` row. |
| C08-E — Late arrival | No fabricated availability confirmation; correct lineup/participation boundaries per match phase; accurate live-reporting consequences; no silent corruption of completed-match history | Pre-kickoff real-Player addition: **PASS** (server-side). Live-phase real-Player pickup: **PASS** (server-side, see reasoning below). Completed-match protection: **PASS** (by inspection of pre-existing, unmodified gating code — not newly browser-tested). Guest late arrival during LIVE: **BLOCKED** (issue #842). Browser-level journey for any of the above: **not produced**. | `match-helper-actions.test.ts` (pre-existing): a real-Player match-day addition works pre-kickoff; removal is blocked once live events exist. `getLiveMatchPreMatchPackageAction` is a plain, un-cached DB query (same test file's "scenario 3"), so a real-Player late arrival is picked up on the next live-reporting page load/refresh — disclosed as the real workflow, not assumed or browser-verified. AFTER-surface gating (`match-detail-shell.tsx`) is pre-existing, unmodified code, confirmed by direct reading, not by a new test in this wave. |

## Summary

No scenario in this table claims browser-level operational proof — that evidence tier does not
exist for C08 in this PR, and this report says so explicitly rather than let a passing database
test or a display-only fixture be read as more than it is. Server-side correctness (the mutation,
its authorization, its persistence, its rejection paths) is genuinely and strongly evidenced for
every sub-requirement except the two explicitly BLOCKED items (RSVP-deadline semantics, which do
not exist in the product at all; guest live-event participation, issue #842, out of this
remediation's scope by the brief's own instruction).
