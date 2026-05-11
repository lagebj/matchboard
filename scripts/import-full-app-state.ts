/**
 * Full App-State Import Script
 *
 * Imports all Matchboard application data from a JSON export file into a Postgres database.
 * Works with both local Postgres and Neon.
 *
 * Usage:
 *   npx tsx scripts/import-full-app-state.ts path/to/export.json
 *
 * The target database must have the schema applied (run `npx prisma migrate deploy` first).
 * The target database must be empty (no existing teams).
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

type ExportData = {
  version: number;
  exportedAt: string;
  source: string;
  schemaVersion: string;
  teams: any[];
  players: any[];
  seasons: any[];
  planningPeriods: any[];
  matchRounds: any[];
  matches: any[];
  availabilities: any[];
  rotationPaths: any[];
  selections: any[];
  movementLedger: any[];
  warnings: any[];
  playerLocks: any[];
  selectionAudits: any[];
  ruleConfigs: any[];
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-full-app-state.ts <path-to-export.json>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  console.log(`Reading export: ${resolvedPath}`);
  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const data: ExportData = JSON.parse(raw);

  console.log(`Export version: ${data.version}, source: ${data.source}, exported at: ${data.exportedAt}`);

  const adapter = createAdapter(connectionString);
  const db = new PrismaClient({ adapter, log: ["warn", "error"] });

  try {
    const existingTeams = await db.team.count();
    if (existingTeams > 0) {
      console.error(`Target database is not empty (found ${existingTeams} teams). Import requires an empty database.`);
      console.error("Run `npx prisma migrate dev` to reset, or use a fresh database.");
      process.exit(1);
    }

    console.log("Importing rule configs...");
    for (const rc of data.ruleConfigs) {
      await db.ruleConfig.create({ data: { name: rc.name, minDaysBetweenAnyMatches: rc.minDaysBetweenAnyMatches, warningThreshold: rc.warningThreshold } });
    }

    console.log("Importing seasons...");
    const seasonIdMap = new Map<string, string>();
    for (const s of data.seasons) {
      const created = await db.season.create({ data: { id: s.id, name: s.name } });
      seasonIdMap.set(s.id, created.id);
    }

    console.log("Importing planning periods...");
    const periodIdMap = new Map<string, string>();
    for (const p of data.planningPeriods) {
      const created = await db.planningPeriod.create({
        data: {
          id: p.id,
          name: p.name,
          seasonId: seasonIdMap.get(p.seasonId) ?? p.seasonId,
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
        },
      });
      periodIdMap.set(p.id, created.id);
    }

    console.log("Importing teams...");
    for (const t of data.teams) {
      await db.team.create({
        data: {
          id: t.id,
          name: t.name,
          targetSquadSize: t.targetSquadSize ?? 11,
          minAcceptedSquadSize: t.minAcceptedSquadSize ?? 9,
          maxSquadSize: t.maxSquadSize ?? 14,
          minCorePlayers: t.minCorePlayers ?? 8,
          minSupportCount: t.minSupportCount ?? 0,
          targetSupportCount: t.targetSupportCount ?? 0,
          maxSupportCount: t.maxSupportCount ?? 0,
          maxPlayerChangesPerRound: t.maxPlayerChangesPerRound ?? 0,
          supportPriority: t.supportPriority ?? 0,
          minSupportPlayers: t.minSupportPlayers ?? 0,
          developmentSlots: t.developmentSlots ?? 0,
          archivedAt: t.archivedAt ? new Date(t.archivedAt) : null,
        },
      });
    }

    console.log("Importing players...");
    for (const p of data.players) {
      await db.player.create({
        data: {
          id: p.id,
          playerCode: p.playerCode,
          firstName: p.firstName,
          lastName: p.lastName ?? null,
          active: p.active ?? true,
          removedAt: p.removedAt ? new Date(p.removedAt) : null,
          coreTeamId: p.coreTeamId,
          nonRotatable: p.nonRotatable ?? false,
          reducedMatchLoadAllowed: p.reducedMatchLoadAllowed ?? false,
          supportSuitability: p.supportSuitability ?? "neutral",
          developmentReadiness: p.developmentReadiness ?? "neutral",
          primaryPosition: p.primaryPosition,
          secondaryPosition: p.secondaryPosition ?? null,
          tertiaryPosition: p.tertiaryPosition ?? null,
          preferredFoot: p.preferredFoot ?? "RIGHT",
          secondaryFoot: p.secondaryFoot ?? "WEAK",
          bestSide: p.bestSide ?? "CENTER",
          currentAvailability: p.currentAvailability ?? "AVAILABLE",
          supportNoShowCount: p.supportNoShowCount ?? 0,
          ballControl: p.ballControl ?? 0,
          passing: p.passing ?? 0,
          firstTouch: p.firstTouch ?? 0,
          oneVOneAttacking: p.oneVOneAttacking ?? 0,
          positioning: p.positioning ?? 0,
          oneVOneDefending: p.oneVOneDefending ?? 0,
          decisionMaking: p.decisionMaking ?? 0,
          effort: p.effort ?? 0,
          teamplay: p.teamplay ?? 0,
          concentration: p.concentration ?? 0,
          speed: p.speed ?? 0,
          strength: p.strength ?? 0,
          notes: p.notes ?? null,
          supportInstruction: p.supportInstruction ?? null,
          developmentInstruction: p.developmentInstruction ?? null,
        },
      });
    }

    console.log("Importing rotation paths...");
    for (const rp of data.rotationPaths) {
      await db.rotationPath.create({
        data: {
          id: rp.id,
          fromTeamId: rp.fromTeamId,
          toTeamId: rp.toTeamId,
          role: rp.role,
          purpose: rp.purpose,
          minimumCount: rp.minimumCount ?? null,
          targetCount: rp.targetCount ?? null,
          maximumCount: rp.maximumCount ?? null,
          cooldownRounds: rp.cooldownRounds ?? null,
          priority: rp.priority ?? null,
          active: rp.active ?? true,
          allowDoubleLoad: rp.allowDoubleLoad ?? false,
          minRestSpacingHours: rp.minRestSpacingHours ?? null,
          maxDoubleLoadsPerPeriod: rp.maxDoubleLoadsPerPeriod ?? null,
        },
      });
    }

    console.log("Importing match rounds...");
    const roundIdMap = new Map<string, string>();
    for (const mr of data.matchRounds) {
      const created = await db.matchRound.create({
        data: {
          id: mr.id,
          name: mr.name,
          planningPeriodId: periodIdMap.get(mr.planningPeriodId) ?? mr.planningPeriodId,
          status: mr.status ?? "DRAFT",
        },
      });
      roundIdMap.set(mr.id, created.id);
    }

    console.log("Importing matches...");
    for (const m of data.matches) {
      await db.match.create({
        data: {
          id: m.id,
          matchRoundId: roundIdMap.get(m.matchRoundId) ?? m.matchRoundId,
          teamId: m.teamId,
          opponent: m.opponent ?? "",
          startsAt: new Date(m.startsAt),
          homeAway: m.homeAway ?? "HOME",
          squadSize: m.squadSize ?? 11,
          availableForDevelopmentSlot: m.availableForDevelopmentSlot ?? false,
          matchType: m.matchType ?? "FRIENDLY",
          gameFormat: m.gameFormat ?? "ELEVEN_A_SIDE",
          formation: m.formation ?? null,
          matchFit: m.matchFit ?? "UNKNOWN",
          notes: m.notes ?? null,
        },
      });
    }

    console.log("Importing availabilities...");
    for (const a of data.availabilities) {
      await db.availability.create({
        data: {
          id: a.id,
          playerId: a.playerId,
          matchRoundId: roundIdMap.get(a.matchRoundId) ?? a.matchRoundId,
          status: a.status,
          note: a.note ?? null,
        },
      });
    }

    console.log("Importing selections...");
    for (const s of data.selections) {
      await db.selection.create({
        data: {
          id: s.id,
          matchId: s.matchId,
          matchRoundId: roundIdMap.get(s.matchRoundId) ?? s.matchRoundId,
          playerId: s.playerId,
          role: s.role,
          controlledDoubleLoad: s.controlledDoubleLoad ?? false,
          status: s.status ?? "DRAFT",
          ruleConfigVersion: s.ruleConfigVersion ?? null,
          explanation: s.explanation ?? undefined,
          overrideReason: s.overrideReason ?? null,
          overrideReasonCategory: s.overrideReasonCategory ?? null,
          overrideReasonDetail: s.overrideReasonDetail ?? null,
        },
      });
    }

    console.log("Importing movement ledger...");
    for (const ml of data.movementLedger) {
      await db.movementLedger.create({
        data: {
          id: ml.id,
          matchRoundId: roundIdMap.get(ml.matchRoundId) ?? ml.matchRoundId,
          matchId: ml.matchId,
          playerId: ml.playerId,
          fromTeamId: ml.fromTeamId,
          toTeamId: ml.toTeamId,
          role: ml.role,
          controlledDoubleLoad: ml.controlledDoubleLoad ?? false,
          reason: ml.reason ?? null,
          explanation: ml.explanation ?? undefined,
          isDraft: ml.isDraft ?? true,
        },
      });
    }

    console.log("Importing warnings...");
    for (const w of data.warnings) {
      await db.warning.create({
        data: {
          id: w.id,
          matchRoundId: roundIdMap.get(w.matchRoundId) ?? w.matchRoundId,
          matchId: w.matchId ?? null,
          playerId: w.playerId ?? null,
          teamId: w.teamId ?? null,
          severity: w.severity,
          rule: w.rule,
          message: w.message,
          resolved: w.resolved ?? false,
        },
      });
    }

    console.log("Importing player locks...");
    for (const pl of data.playerLocks) {
      await db.playerLock.create({
        data: {
          id: pl.id,
          matchRoundId: roundIdMap.get(pl.matchRoundId) ?? pl.matchRoundId,
          playerId: pl.playerId,
          lockType: pl.lockType,
          reason: pl.reason ?? null,
          lockedBy: pl.lockedBy ?? null,
        },
      });
    }

    console.log("Importing selection audits...");
    for (const sa of data.selectionAudits) {
      await db.selectionAudit.create({
        data: {
          id: sa.id,
          selectionId: sa.selectionId,
          changeReason: sa.changeReason,
          previousRole: sa.previousRole ?? null,
          previousStatus: sa.previousStatus ?? null,
        },
      });
    }

    console.log("\nImport complete!");

    const counts = {
      teams: await db.team.count(),
      players: await db.player.count(),
      seasons: await db.season.count(),
      planningPeriods: await db.planningPeriod.count(),
      matchRounds: await db.matchRound.count(),
      matches: await db.match.count(),
      availabilities: await db.availability.count(),
      rotationPaths: await db.rotationPath.count(),
      selections: await db.selection.count(),
      movementLedger: await db.movementLedger.count(),
      warnings: await db.warning.count(),
      playerLocks: await db.playerLock.count(),
      selectionAudits: await db.selectionAudit.count(),
      ruleConfigs: await db.ruleConfig.count(),
    };

    console.log("Target database counts:");
    for (const [key, value] of Object.entries(counts)) {
      console.log(`  ${key}: ${value}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});