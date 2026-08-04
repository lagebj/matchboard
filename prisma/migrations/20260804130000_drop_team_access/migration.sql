-- MT-9: Drop TeamAccess model
-- Per ADR-0049: GroupAccess replaces TeamAccess as the operational access control.
-- All team access is now derived from group membership (every team has a footballGroupId).
-- The backfill script has already mirrored existing TeamAccess rows to GroupAccess rows.
-- This migration drops the TeamAccess table and removes the relation columns.

DROP TABLE IF EXISTS "TeamAccess";