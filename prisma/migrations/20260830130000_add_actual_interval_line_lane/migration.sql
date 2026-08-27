-- Phase 3 hardening: ActualPositionInterval gains explicit line/lane classification.
-- Combination topology derivation must not parse position labels/role-type strings to guess
-- line (GK/DEF/MID/ATT) and lane (LEFT/CENTRE/RIGHT) — those are derived once, at timeline
-- rebuild time, from the resolved formation slot (roleType + gridX) and persisted here.
-- Null means "not reliably known" (e.g. a position-change event with no resolved slot), never a
-- guess. See ADR-0094.

ALTER TABLE "ActualPositionInterval" ADD COLUMN "line" TEXT;
ALTER TABLE "ActualPositionInterval" ADD COLUMN "lane" TEXT;
