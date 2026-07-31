import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getRules } from "@/lib/rules/get-rules";
import { exportRuleConfig, validateImportedRuleConfig } from "@/lib/rules/validate-rules";

export async function GET() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  try {
    const rules = await getRules(orgFilter);
    const exported = exportRuleConfig(rules);
    return new Response(JSON.stringify(exported, null, 2), {
      headers: {
        "Content-Disposition": 'attachment; filename="matchboard-rules.json"',
        "Content-Type": "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to export rules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  try {
    const body = await request.json();
    const validation = validateImportedRuleConfig(body);

    if (validation.errors.length > 0) {
      return NextResponse.json({ errors: validation.errors, warnings: validation.warnings }, { status: 400 });
    }

    const data = body as Record<string, unknown>;

    const currentRules = await getRules(orgFilter);

    const updated = await db.ruleConfig.update({
      where: { id: currentRules.id },
      data: {
        name: String(data.name ?? currentRules.name),
        minDaysBetweenAnyMatches: Number(data.minDaysBetweenAnyMatches ?? currentRules.minDaysBetweenAnyMatches),
        warningThreshold: Number(data.warningThreshold ?? currentRules.warningThreshold),
        version: { increment: 1 },
        ...(orgFilter.type === "org" ? { organisationId: orgFilter.organisationId } : {}),
      },
    });

    return NextResponse.json({
      rules: updated,
      warnings: validation.warnings,
    });
  } catch {
    return NextResponse.json({ error: "Failed to import rules" }, { status: 500 });
  }
}