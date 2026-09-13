-- Atlas Follow-up (05_SHIRT_IDENTITY_AND_TEAM_KIT_COLOR.md): one canonical, presentation-only
-- kit colour per team. Additive/nullable — safe under ADR-0105 regardless of deploy order.
ALTER TABLE "Team" ADD COLUMN "kitColor" TEXT;
