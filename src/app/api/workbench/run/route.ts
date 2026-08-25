import { NextRequest, NextResponse } from "next/server";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import type { WorkbenchRunRequest } from "@/lib/workbench/workbench-types";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const rl = await rateLimit("workbench:run", 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: WorkbenchRunRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.source || (body.source === "fixture" && !body.fixtureId)) {
    return NextResponse.json(
      { error: "source must be 'fixture' with a fixtureId, or 'app_data' (not yet supported)" },
      { status: 400 },
    );
  }

  if (body.source === "app_data") {
    return NextResponse.json(
      { error: "app_data source is not yet supported. Use fixture source." },
      { status: 501 },
    );
  }

  try {
    const { runWorkbench } = await import("@/lib/workbench/workbench-service");
    const result = await runWorkbench(body);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}