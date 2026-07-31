-- MT-7: Add SUPPORT role to OrganisationRole enum
-- Per ADR-0040: Support access uses a time-bound SUPPORT role with explicit OWNER consent,
-- read-only access, full audit logging, and automatic expiry.

ALTER TYPE "OrganisationRole" ADD VALUE 'SUPPORT';