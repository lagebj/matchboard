import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { repairLegacySqliteDatabase } from "@/lib/db/repair-legacy-sqlite";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnectionString: string | undefined;
};

function resolveSqliteConnectionString(connectionString: string) {
  if (
    connectionString === ":memory:" ||
    !connectionString.startsWith("file:./") && !connectionString.startsWith("file:../")
  ) {
    return connectionString;
  }

  const sqlitePath = connectionString.slice("file:".length);

  return `file:${path.resolve(process.cwd(), "prisma", sqlitePath)}`;
}

function resolveSqlitePath(connectionString: string) {
  if (!connectionString.startsWith("file:")) {
    return null;
  }

  return connectionString.slice("file:".length);
}

const connectionString = resolveSqliteConnectionString(process.env.DATABASE_URL ?? "");
const sqlitePath = resolveSqlitePath(connectionString);

if (sqlitePath) {
  repairLegacySqliteDatabase(sqlitePath);
}

const adapter = new PrismaBetterSqlite3({ url: connectionString });
const cachedPrisma =
  globalForPrisma.prismaConnectionString === connectionString
    ? globalForPrisma.prisma
    : undefined;

export const db =
  cachedPrisma ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaConnectionString = connectionString;
}
