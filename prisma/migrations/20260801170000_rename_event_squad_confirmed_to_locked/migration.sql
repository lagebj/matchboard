-- Rename EventSquadStatus CONFIRMED to LOCKED
-- Squads are operational without requiring confirmation. LOCKED is an optional
-- advisory state meaning "coach has locked this squad for planning", not a
-- mandatory review gate.

ALTER TYPE "EventSquadStatus" RENAME VALUE 'CONFIRMED' TO 'LOCKED';