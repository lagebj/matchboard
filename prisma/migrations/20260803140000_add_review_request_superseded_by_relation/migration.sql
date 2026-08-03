-- Add self-relation for ReviewRequest supersededBy
-- supersededById column already exists; this migration adds the foreign key constraint and index

ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ReviewRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ReviewRequest_supersededById_idx" ON "ReviewRequest"("supersededById");