-- Reclassify EventMatch rows from TOURNAMENT events that have category='CUP' to category='OTHER'.
-- Tournament events should map to OTHER category for player statistics, not CUP.
-- Only CUP events should have category='CUP'.

UPDATE "EventMatch"
SET category = 'OTHER'
WHERE category = 'CUP'
  AND "eventId" IN (SELECT id FROM "Event" WHERE "eventType" = 'TOURNAMENT');