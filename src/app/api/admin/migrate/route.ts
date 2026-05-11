import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { migrateDoubleLoadRoles } from "@/lib/selection/migrate-double-load-roles";
import { migrateSquadRepairRoles } from "@/lib/selection/migrate-squad-repair-roles";
import { backfillMovementLedger } from "@/lib/selection/backfill-movement-ledger";

export async function POST(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("admin-migrate", 2, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many migration requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { migration } = body;

  if (typeof migration !== "string") {
    return NextResponse.json({ error: "migration field is required" }, { status: 400 });
  }

  const validMigrations = ["double-load-roles", "squad-repair-roles", "movement-ledger", "all"];
  if (!validMigrations.includes(migration)) {
    return NextResponse.json(
      { error: `Invalid migration. Valid options: ${validMigrations.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const results: Record<string, unknown> = {};

    if (migration === "double-load-roles" || migration === "all") {
      results.doubleLoadRoles = await migrateDoubleLoadRoles();
    }

    if (migration === "squad-repair-roles" || migration === "all") {
      results.squadRepairRoles = await migrateSquadRepairRoles();
    }

    if (migration === "movement-ledger" || migration === "all") {
      results.movementLedger = await backfillMovementLedger();
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}