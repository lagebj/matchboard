import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Database connection configuration
//
// RLS role architecture (per ADR-0037):
// - DATABASE_URL: Uses matchboard_app role (restricted by RLS, for runtime queries)
//   Must NOT have BYPASSRLS. Tenant context is set via SET LOCAL in transactions.
// - DIRECT_URL: Uses matchboard_admin role (BYPASSRLS, for Prisma migrations only)
//   This role can bypass RLS for schema changes and data migrations.
//
// For local development without RLS roles, the default PostgreSQL user is used
// and RLS policies are not enforced (superuser bypasses RLS).
//
// See: docs/adr/0037-row-level-security-and-database-role-isolation.md
// See: scripts/create-rls-roles.sh

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set. Add it to your .env file.");
}

const adapter = connectionString.includes(".neon.tech")
  ? new PrismaNeon({ connectionString })
  : new PrismaPg(new pg.Pool({ connectionString }));

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}