import { NextRequest, NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getAvailableCommands } from "@/lib/commands/registry";
import { db } from "@/lib/db";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  let ctx;
  try {
    ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organisations = await db.organisationMembership.findMany({
    where: { userId: ctx.userId },
    select: {
      organisationId: true,
      organisation: { select: { id: true, name: true, slug: true } },
      role: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    currentOrganisation: {
      id: ctx.organisationId,
      name: organisations.find((o) => o.organisation.id === ctx.organisationId)?.organisation.name ?? "",
      slug: organisations.find((o) => o.organisation.id === ctx.organisationId)?.organisation.slug ?? "",
    },
    organisations: organisations.map((o) => ({
      id: o.organisation.id,
      name: o.organisation.name,
      slug: o.organisation.slug,
      role: o.role,
      isCurrent: o.organisation.id === ctx.organisationId,
    })),
    commands: getAvailableCommands(ctx),
  });
}
