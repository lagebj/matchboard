# Gate C W3 — Blockers and Known Limitations

## C07 — not a blocker, a disclosed authority override

See `SOURCE_RECONCILIATION.md`. W1's deferral reasoning is directly addressed, not silently
overridden: the production-integration gap is real and disclosed in full in
`C07_PRODUCTION_INTEGRATION_GAP.md`. A separate, now-fixed defect (C07-ON's Promote/Dismiss
controls called the real, session-requiring Server Actions against a synthetic fixture id) was
found by an external remediation review and fixed by adding an optional handler-override seam —
see `C07_PRODUCTION_INTEGRATION_GAP.md`'s "Remediation finding and fix" and `REVIEW_RECORD.md`
pass 3.

## C08's official "after RSVP" requirement — BLOCKED, not satisfied

The official register lists "after RSVP" among C08's required states. Matchboard has no
automated RSVP-deadline mechanism at all — confirmed by code inspection
(`PlannedAbsenceReason.NO_RSVP` is a manually-selected category, not a computed deadline), and
by the same disclosure Gate A's A09 already made for an analogous gap. This requirement is
**BLOCKED**: no scenario in this wave satisfies it, and none is labelled as if it did. C08-B
instead demonstrates a real, adjacent, separately-verified mechanism (`TENTATIVE`
`Player.currentAvailability`) as disclosed supplementary coverage only — see
`C08_OPERATIONAL_ACCEPTANCE.md` and the page/fixture doc comments under
`c08-same-day-quick-add/after-availability-change/`.

## C08-D/E — no fixture route (disclosed, not a defect)

`AddPlayerDialog` (Match Details "Add player") self-fetches its own candidate lists via real
Server Actions (`getLeagueMatchHelperCandidatesAction`/`getLeagueMatchGuestCandidatesAction`) —
it is not prop-driven like `TodaySurface`/`RoundBoard`. Mounting it against static fixture props
in `/dev/ui-lab` would require either (a) seeding a real match behind it anyway (making the
"fixture" indistinguishable from just using the real page), or (b) faking its data layer, which
the brief's own §7 forbids ("A simulated success message without a successful underlying
mutation is not acceptable"). C08-D/E are instead evidenced by real-DB integration tests
(`league-match-guest-actions.test.ts`, `match-helper-actions.test.ts`) exercising the actual
production mutations against a disposable test Postgres database — not a UI Lab display route,
and not a CI screenshot. See `VISUAL_VS_CURRENT.md` for how visual evidence is handled for these
two scenarios.

## C08 (all of A/B/C/D/E) — no authenticated browser-level evidence exists in this wave

An external remediation review correctly flagged that database-integration evidence, however
genuine, is not the same claim as "an eligible player can be added through Today" verified via
the application's own UI. That stronger evidence was investigated and explicitly not pursued,
for a documented, pre-existing reason rather than a new one invented for this wave:

- This repo's one existing precedent for a seeded, authenticated, browser-driven mutation test —
  `e2e/round-mutation.spec.ts` — is itself currently `test.skip()`-disabled. Its own comment
  states the heavy multi-step seed endpoints it depends on (create match → generate round →
  finalize/reopen) now consistently time out on Vercel serverless since the Next.js 16 proxy
  migration (Edge → Node runtime); it only ever ran locally even before that.
- No existing test-agent seed endpoint reliably produces the exact state C08-A's quick-add needs
  (an available player with no planned opportunity and a real rotation-path destination) over
  HTTP — the rotation-path wiring that would support it exists only inside the Vitest-only
  `seedTestFixture()` helper, not reachable from Playwright. Building a new one would be new,
  non-trivial test infrastructure carrying the same documented timeout risk.
- Running any real browser test against a live, authenticated Test slot additionally requires
  applying the `acceptance` PR label, which provisions a real Neon branch and a real Vercel
  deployment — a deliberate, costly action, never an automatic consequence of pushing a commit.

Given this, the repository owner was asked directly whether to invest in building new seed
infrastructure and request that Test-slot provisioning, accepting the real chance of hitting the
same timeout class the existing precedent already hit, or to document the limitation and rely on
the strongest evidence that is actually safe to produce in this environment. The owner chose the
latter. **No browser-level evidence is claimed anywhere in this wave's docs for any C08
sub-scenario** — `C08_OPERATIONAL_ACCEPTANCE.md`'s disposition table marks every such requirement
PARTIAL (server-side evidence only) rather than PASS, and every UI Lab fixture route for C08 is
explicitly labelled display-only.

## Real defect found and fixed: guest-add had no cancelled-match guard

`addLeagueMatchGuestAction` (both branches) and `createAndAddMatchGuestAction` had no check at all
for a cancelled match, unlike the equivalent real-Player path
(`assertLeagueMatchHelperEligible()`). Fixed in this branch — `requireMatchNotCancelled()` added
to `league-match-guest-actions.ts`, with a new regression test.

## Real gap found, disclosed, not fixed: guests invisible to live-reporting

`getLiveMatchPreMatchPackageAction()`'s squad array never includes
`LeagueMatchGuestAssignment` rows, so a guest added via the real "Add player" dialog cannot be
selected as a scorer/assist/rotation participant during live event recording, even though
`LiveMatchEvent.guestPlayerId`/`secondaryGuestPlayerId` columns already anticipate it.
`live-match-client.tsx`'s ~900-line event-recording flow is built entirely around a required
`playerId: string`, so wiring guests in is a real client-wide capability addition, not a
smallest-safe-seam fix — out of scope for this wave. Filed as
[issue #842](https://github.com/lagebj/matchboard/issues/842). A regression test documenting the
current (gap) behavior exists in `league-match-guest-actions.test.ts`
(`"DISCLOSED GAP: a guest does not yet appear in the live pre-match package squad..."`), intended
to flip green once the capability ships.

Practical consequence for C08-E ("accurate consequences for live reporting"): a real-Player
match-day addition (`addLeagueMatchHelperAction`, confirmed by `getLiveMatchPreMatchPackageAction`
being a plain fresh DB query, never a session-start snapshot) *is* correctly picked up by the live
pre-match package the next time it's fetched (e.g. a page refresh) — a coach adding a late-arriving
real Player during a live match should refresh/reopen the live-reporting view to see them in the
picker. A late-arriving **guest**, by contrast, is not pickable at all today, per the gap above.

## Observation (not a defect): C08-C's fallback text is generic

When a decision's only destination has planning closed, the real planner returns
`recommendation: null` entirely, and the row falls back to the plain default text "Review on the
Round Board." — accurate, but less specific than the TENTATIVE case's own named reason. Not
fixed in this wave (pre-existing, unrelated to anything touched here); noted for a future UX pass.

## Issues #827 / #830

Both remain open, unrelated, untouched by this wave — see `SOURCE_RECONCILIATION.md`.
