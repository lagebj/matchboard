-- Bug fix: src/lib/evidence/actual-timeline.ts and combination-topology.ts have queried
-- Match.matchDurationMinutes since the evidence-driven-coaching-loop merge to cap the final
-- actual-position interval at match end. The field never existed on Match (only Event has it),
-- so both functions threw "Unknown field" on every real invocation -- undiscovered until the
-- user-documentation-experience seed script first exercised them end-to-end against a real
-- database. Nullable: preserves existing behaviour (final interval left open-ended) until a UI
-- sets it.
ALTER TABLE "Match" ADD COLUMN "matchDurationMinutes" INTEGER;
