-- Event.breakDurationMinutes: minutes of break between halves, only meaningful when
-- numberOfHalves=2 (ignored otherwise). Null means "not tracked" -- getEventMatchWindow()/
-- getEventPeriodConfig() treat null the same as 0 for match-length/window purposes.
ALTER TABLE "Event" ADD COLUMN "breakDurationMinutes" INTEGER;

-- EventSquad per-squad overrides for match timing, following the same nullable-override pattern
-- as gameFormatOverride: null inherits the Event default, a set value overrides it for this
-- squad only. Resolved through getEffectiveEventSquadNumberOfHalves()/
-- getEffectiveEventSquadMatchDurationMinutes()/getEffectiveEventSquadBreakDurationMinutes()
-- (src/lib/events/event-types.ts).
ALTER TABLE "EventSquad" ADD COLUMN "numberOfHalvesOverride" INTEGER;
ALTER TABLE "EventSquad" ADD COLUMN "matchDurationMinutesOverride" INTEGER;
ALTER TABLE "EventSquad" ADD COLUMN "breakDurationMinutesOverride" INTEGER;
