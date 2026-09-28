-- ADR-0152 follow-up (ref-token resolution fix): persist each AiAdvisorReview's own ephemeral
-- ref map at save time. Purely additive nullable column — reviews saved before this migration
-- keep `NULL` and display layers fall back to the (fingerprint-fresh-only) rebuild path.

ALTER TABLE "AiAdvisorReview" ADD COLUMN "refMap" JSONB;
