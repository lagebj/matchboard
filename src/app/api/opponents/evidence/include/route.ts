import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { includeOpponentSportingEvidence } from "@/lib/opponents/sporting-level-recording";

export async function POST(request: Request) {
  try {
    const coach = await requireCoachAccess();
    if (!coach) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
    if (orgFilter.type !== "org") {
      return NextResponse.json({ error: "Organisation access required" }, { status: 403 });
    }

    const body = await request.json();
    const { evidenceId } = body;

    if (!evidenceId) {
      return NextResponse.json({ error: "evidenceId is required" }, { status: 400 });
    }

    const result = await includeOpponentSportingEvidence(evidenceId, orgFilter);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}