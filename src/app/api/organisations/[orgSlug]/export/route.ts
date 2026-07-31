import { NextRequest, NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrganisationOwner } from "@/lib/organisations/organisation-resolver";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  const coach = await requireCoachAccess();
  const { orgSlug } = await params;

  let ctx;
  try {
    ctx = await resolveOrganisationOwner(orgSlug);
  } catch {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const org = await db.organisation.findUnique({
    where: { id: ctx.organisationId },
    select: {
      id: true,
      name: true,
      slug: true,
      isSynthetic: true,
      createdAt: true,
      memberships: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, email: true, name: true } },
          teamAccesses: { select: { teamId: true, team: { select: { id: true, name: true } } } },
        },
        orderBy: { role: "asc" },
      },
      teams: {
        select: {
          id: true,
          name: true,
          targetSquadSize: true,
          minCorePlayers: true,
          maxSquadSize: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      },
      players: {
        select: {
          id: true,
          playerCode: true,
          firstName: true,
          lastName: true,
          active: true,
          primaryPosition: true,
          currentAvailability: true,
          coreTeamId: true,
          createdAt: true,
        },
        orderBy: { playerCode: "asc" },
      },
      leagueSeasons: {
        select: {
          id: true,
          name: true,
          part: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
        orderBy: { startDate: "asc" },
      },
    },
  });

  if (!org) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: coach.email ?? "unknown",
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isSynthetic: org.isSynthetic,
      createdAt: org.createdAt,
    },
    memberships: org.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      user: { id: m.user.id, email: m.user.email, name: m.user.name },
      teamAccess: m.teamAccesses.map((ta) => ({
        teamId: ta.team.id,
        teamName: ta.team.name,
      })),
    })),
    teams: org.teams.map((t) => ({
      id: t.id,
      name: t.name,
      targetSquadSize: t.targetSquadSize,
      minCorePlayers: t.minCorePlayers,
      maxSquadSize: t.maxSquadSize,
      createdAt: t.createdAt,
    })),
    players: org.players.map((p) => ({
      id: p.id,
      playerCode: p.playerCode,
      firstName: p.firstName,
      lastName: p.lastName,
      active: p.active,
      primaryPosition: p.primaryPosition,
      currentAvailability: p.currentAvailability,
      coreTeamId: p.coreTeamId,
      createdAt: p.createdAt,
    })),
    leagueSeasons: org.leagueSeasons.map((ls) => ({
      id: ls.id,
      name: ls.name,
      part: ls.part,
      startDate: ls.startDate,
      endDate: ls.endDate,
      createdAt: ls.createdAt,
    })),
  };

  const accept = request.headers.get("accept") ?? "";
  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (format === "csv") {
    const rows: string[] = [];
    rows.push("Type,Id,Name,Role,Email,Active,Position,Availability,CreatedAt");
    for (const m of org.memberships) {
      rows.push(`Membership,${m.id},${m.user.name ?? ""},${m.role},${m.user.email},,${m.user.id},${m.id}`);
    }
    for (const t of org.teams) {
      rows.push(`Team,${t.id},${t.name},,,,${t.createdAt}`);
    }
    for (const p of org.players) {
      rows.push(`Player,${p.id},${p.firstName} ${p.lastName ?? ""},,${p.active},${p.primaryPosition},${p.currentAvailability},${p.createdAt}`);
    }
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${org.slug}-export.csv"`,
      },
    });
  }

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="${org.slug}-export.json"`,
    },
  });
}