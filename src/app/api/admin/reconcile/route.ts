import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileCanonicalDerivedData } from "@/lib/data-integrity/reconcile-canonical-derived-data";

const VALID_DOMAINS = [
  "PLAYER_GOALS_DERIVED_PROJECTION",
  "PLAYER_ASSISTS_DERIVED_PROJECTION",
  "OPPONENT_SNAPSHOT_DERIVED_PROJECTION",
  "ACTIVE_PLAN_INTEGRITY_PROJECTION",
] as const;

type ValidDomain = (typeof VALID_DOMAINS)[number];

export async function POST(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("admin-reconcile", 2, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many reconciliation requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const planningPeriodId = typeof body.planningPeriodId === "string" ? body.planningPeriodId : undefined;
  const matchId = typeof body.matchId === "string" ? body.matchId : undefined;
  const rawDomains = body.domains;

  if (!Array.isArray(rawDomains) || rawDomains.length === 0) {
    return NextResponse.json(
      { error: `domains field is required and must be a non-empty array. Valid options: ${VALID_DOMAINS.join(", ")}` },
      { status: 400 },
    );
  }

  const domains: ValidDomain[] = [];
  for (const d of rawDomains) {
    if (typeof d === "string" && (VALID_DOMAINS as readonly string[]).includes(d)) {
      domains.push(d as ValidDomain);
    }
  }

  if (domains.length === 0) {
    return NextResponse.json(
      { error: `No valid domains provided. Valid options: ${VALID_DOMAINS.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const result = await reconcileCanonicalDerivedData({
      dryRun,
      planningPeriodId,
      matchId,
      domains,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}