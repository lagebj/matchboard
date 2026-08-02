import { NextRequest, NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let coach;
  try {
    coach = await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  if (orgFilter.type !== "org") {
    return NextResponse.json({
      currentOrganisation: null,
      organisations: [],
      commands: getPublicCommands(),
    });
  }

  const membership = await db.organisationMembership.findFirst({
    where: { userId: coach.id ?? "", organisationId: orgFilter.organisationId },
    select: { id: true, role: true },
  });

  const organisations = await db.organisationMembership.findMany({
    where: { userId: coach.id ?? "" },
    select: {
      organisationId: true,
      organisation: { select: { id: true, name: true, slug: true } },
      role: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const role = membership?.role ?? "VIEWER";
  const canCreate = role === "OWNER" || role === "ADMIN" || role === "COACH";
  const canManageOrg = role === "OWNER" || role === "ADMIN";

  return NextResponse.json({
    currentOrganisation: {
      id: orgFilter.organisationId,
      name: organisations.find((o) => o.organisation.id === orgFilter.organisationId)?.organisation.name ?? "",
      slug: organisations.find((o) => o.organisation.id === orgFilter.organisationId)?.organisation.slug ?? "",
    },
    organisations: organisations.map((o) => ({
      id: o.organisation.id,
      name: o.organisation.name,
      slug: o.organisation.slug,
      role: o.role,
      isCurrent: o.organisation.id === orgFilter.organisationId,
    })),
    commands: getFilteredCommands(canCreate, canManageOrg),
  });
}

function getPublicCommands(): CommandItem[] {
  return [
    { id: "nav-assistant", label: "Assistant", href: "/assistant", category: "navigate", keywords: ["assistant", "dashboard"] },
    { id: "nav-fixtures", label: "Fixtures", href: "/fixtures", category: "navigate", keywords: ["fixtures", "matches"] },
    { id: "nav-teams", label: "Teams", href: "/teams", category: "navigate", keywords: ["teams"] },
    { id: "nav-players", label: "Players", href: "/players", category: "navigate", keywords: ["players"] },
  ];
}

function getFilteredCommands(canCreate: boolean, canManageOrg: boolean): CommandItem[] {
  const commands: CommandItem[] = [
    { id: "nav-assistant", label: "Assistant", description: "Next actions and blockers", href: "/assistant", category: "navigate", keywords: ["assistant", "dashboard", "home"] },
    { id: "nav-fixtures", label: "Fixtures", description: "Season and match overview", href: "/fixtures", category: "navigate", keywords: ["fixtures", "matches", "rounds", "schedule"] },
    { id: "nav-teams", label: "Teams", description: "Team registry and detail", href: "/teams", category: "navigate", keywords: ["teams", "squad"] },
    { id: "nav-players", label: "Players", description: "Player registry and profiles", href: "/players", category: "navigate", keywords: ["players", "registry"] },
    { id: "nav-season", label: "Season", description: "Season matrix and fairness", href: "/season", category: "navigate", keywords: ["season", "matrix", "fairness"] },
    { id: "nav-rules", label: "Rules", description: "Selection rules and rotation paths", href: "/rules", category: "navigate", keywords: ["rules", "config", "paths"] },
    { id: "nav-events", label: "Events", description: "Event squads and planning", href: "/events", category: "navigate", keywords: ["events", "cups", "tournaments"] },
  ];

  if (canCreate) {
    commands.push(
      { id: "create-team", label: "Create team", description: "Add a new team", href: "/teams/new", category: "create", keywords: ["create", "new", "add", "team"] },
      { id: "create-player", label: "Create player", description: "Add a new player", href: "/players/new", category: "create", keywords: ["create", "new", "add", "player"] },
      { id: "create-fixture", label: "Create fixture", description: "Add a new match", href: "/matches/new", category: "create", keywords: ["create", "new", "add", "match", "fixture"] },
      { id: "create-event", label: "Create event", description: "Add a new event", href: "/events/new", category: "create", keywords: ["create", "new", "add", "event", "cup", "tournament"] },
    );
  }

  if (canManageOrg) {
    commands.push(
      { id: "nav-simulation", label: "Simulation", description: "Run season simulation", href: "/simulation", category: "navigate", keywords: ["simulation", "dry-run", "plan"] },
      { id: "nav-workbench", label: "Policy workbench", description: "Policy evaluation workbench", href: "/workbench", category: "navigate", keywords: ["workbench", "policy", "rego"] },
    );
  }

  return commands;
}

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  href: string;
  category: "navigate" | "create";
  keywords: string[];
};