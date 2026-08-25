import { populateAllDrafts } from "@/lib/selection/populate-all-drafts";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { populateAllSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function POST(request: Request) {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const { allowed } = await rateLimit("populate-all", 3, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many populate-all requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = populateAllSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const { leagueSeasonId } = parsed.data;

  const leagueSeason = await db.leagueSeason.findFirst({
    where: { id: leagueSeasonId },
    select: { id: true, name: true, organisationId: true },
  });

  if (!leagueSeason) {
    return NextResponse.json({ error: "League season not found" }, { status: 404 });
  }

  if (leagueSeason.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
  }

  try {
    const result = await populateAllDrafts(leagueSeasonId);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}