-- AlterEnum: Remove DOUBLE_LOAD from SelectionRole
-- This migration should be run AFTER the data migration API has been called
-- to convert all existing DOUBLE_LOAD selection rows to their base role + controlledDoubleLoad=true flag.
-- See: POST /api/admin/migrate with migration=double-load-roles

-- For PostgreSQL:
ALTER TYPE "SelectionRole" DELETE VALUE 'DOUBLE_LOAD';