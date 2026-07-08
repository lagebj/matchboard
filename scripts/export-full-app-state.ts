/**
 * Full App-State Export Script
 *
 * Exports all Matchboard application data to a JSON file.
 * Works with both local Postgres and Neon.
 *
 * Usage:
 *   npx tsx scripts/export-full-app-state.ts
 *
 * Output: exports/matchboard-full-export-YYYY-MM-DD.json
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import fs from "node:fs";
import path from "node:path";

function createAdapter(url: string) {
  if (url.includes(".neon.tech")) {
    const { PrismaNeon } = require("@prisma/adapter-neon") as typeof import("@prisma/adapter-neon");
    return new PrismaNeon({ connectionString: url });
  }
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({ connectionString: url });
  return new PrismaPg(pool);
}

const EXPORT_VERSION = 2;

type ExportData = {
  version: number;
  exportedAt: string;
  source: string;
  schemaVersion: string;
  teams: unknown[];
  players: unknown[];
  seasons: unknown[];
  leagueSeasons: unknown[];
  matchRounds: unknown[];
  matches: unknown[];
  availabilities: unknown[];
  rotationPaths: unknown[];
  selections: unknown[];
  movementLedger: unknown[];
  warnings: unknown[];
  playerLocks: unknown[];
  selectionAudits: unknown[];
  ruleConfigs: unknown[];
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  console.log(`Exporting from: ${connectionString.includes("neon.tech") ? "Neon Postgres" : "local Postgres"}`);

  const adapter = createAdapter(connectionString);
  const db = new PrismaClient({ adapter, log: ["warn", "error"] });

  try {
    const [
      teams,
      players,
      seasons,
      leagueSeasons,
      matchRounds,
      matches,
      availabilities,
      rotationPaths,
      selections,
      movementLedger,
      warnings,
      playerLocks,
      selectionAudits,
      ruleConfigs,
    ] = await Promise.all([
      db.team.findMany({ where: { archivedAt: null } }),
      db.player.findMany({ where: { removedAt: null, active: true } }),
      db.season.findMany(),
      db.leagueSeason.findMany(),
      db.matchRound.findMany(),
      db.match.findMany(),
      db.availability.findMany(),
      db.rotationPath.findMany({ where: { active: true } }),
      db.selection.findMany(),
      db.movementLedger.findMany(),
      db.warning.findMany(),
      db.playerLock.findMany(),
      db.selectionAudit.findMany(),
      db.ruleConfig.findMany(),
    ]);

    const exportData: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      source: connectionString.includes("neon.tech") ? "neon" : "local",
      schemaVersion: "2025-05-12-postgres-baseline",
      teams,
      players,
      seasons,
      leagueSeasons,
      matchRounds,
      matches,
      availabilities,
      rotationPaths,
      selections,
      movementLedger,
      warnings,
      playerLocks,
      selectionAudits,
      ruleConfigs,
    };

    const exportsDir = path.join(process.cwd(), "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const date = new Date().toISOString().split("T")[0];
    const filename = `matchboard-full-export-${date}.json`;
    const filepath = path.join(exportsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    console.log(`\nExport complete!`);
    console.log(`  Teams:           ${teams.length}`);
    console.log(`  Players:         ${players.length}`);
    console.log(`  Seasons:         ${seasons.length}`);
    console.log(`  League seasons:${leagueSeasons.length}`);
    console.log(`  Match rounds:    ${matchRounds.length}`);
    console.log(`  Matches:         ${matches.length}`);
    console.log(`  Availabilities:  ${availabilities.length}`);
    console.log(`  Rotation paths:  ${rotationPaths.length}`);
    console.log(`  Selections:      ${selections.length}`);
    console.log(`  Movement ledger: ${movementLedger.length}`);
    console.log(`  Warnings:        ${warnings.length}`);
    console.log(`  Player locks:    ${playerLocks.length}`);
    console.log(`  Selection audits:${selectionAudits.length}`);
    console.log(`  Rule configs:    ${ruleConfigs.length}`);
    console.log(`\nFile: ${filepath}`);
    console.log(`Size: ${(fs.statSync(filepath).size / 1024).toFixed(1)} KB`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("Export failed:", e);
  process.exit(1);
});