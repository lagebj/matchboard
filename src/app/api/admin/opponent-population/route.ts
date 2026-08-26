import { NextRequest, NextResponse } from "next/server";
import { requireActorContext, canAdmin } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { applyOpponentEvidenceHistory, dryRunOpponentEvidence } from "@/lib/evidence/opponent-replay";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug");
  const mode = searchParams.get("mode") ?? "dryrun";
  const gameFormat = searchParams.get("gameFormat") ?? undefined;
  const fromStr = searchParams.get("from") ?? undefined;
  const toStr = searchParams.get("to") ?? undefined;

  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await requireActorContext(orgSlug);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAdmin(ctx)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  setTenantOrganisationId(ctx.organisationId);

  const options = {
    gameFormat,
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
  };

  try {
    const result = await dryRunOpponentEvidence(ctx.organisationId, options);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug");

  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await requireActorContext(orgSlug);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAdmin(ctx)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  setTenantOrganisationId(ctx.organisationId);

  try {
    const result = await applyOpponentEvidenceHistory(ctx.organisationId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}