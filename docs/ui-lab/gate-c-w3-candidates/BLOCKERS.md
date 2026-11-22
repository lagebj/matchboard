# Gate C W3 — Blockers and Known Limitations

## C07 — not a blocker, a disclosed authority override

See `SOURCE_RECONCILIATION.md`. W1's deferral reasoning is directly addressed, not silently
overridden: the production-integration gap is real and disclosed in full in
`C07_PRODUCTION_INTEGRATION_GAP.md`.

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
