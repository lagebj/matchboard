import { NextRequest, NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireActorContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.organisationMembership.findFirst({
    where: { userId: ctx.userId, organisationId: ctx.organisationId },
    select: { id: true, role: true },
  });

  const organisations = await db.organisationMembership.findMany({
    where: { userId: ctx.userId },
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
    commands: getFilteredCommands(canCreate, canManageOrg, ctx.organisationSlug),
  });
}

function getPublicCommands(orgSlug: string): CommandItem[] {
  const prefix = `/o/${orgSlug}`;
  return [
    { id: "nav-assistant", label: "Assistant", href: `${prefix}/assistant`, category: "navigate", keywords: ["assistant", "dashboard"] },
    { id: "nav-fixtures", label: "Fixtures", href: `${prefix}/fixtures`, category: "navigate", keywords: ["fixtures", "matches"] },
    { id: "nav-teams", label: "Teams", href: `${prefix}/teams`, category: "navigate", keywords: ["teams"] },
    { id: "nav-players", label: "Players", href: `${prefix}/players`, category: "navigate", keywords: ["players"] },
  ];
}

function getFilteredCommands(canCreate: boolean, canManageOrg: boolean, orgSlug: string): CommandItem[] {
  const prefix = `/o/${orgSlug}`;
  const commands: CommandItem[] = [
    { id: "nav-assistant", label: "Assistant", description: "Next actions and blockers", href: `${prefix}/assistant`, category: "navigate", keywords: ["assistant", "dashboard", "home"] },
    { id: "nav-fixtures", label: "Fixtures", description: "Season and match overview", href: `${prefix}/fixtures`, category: "navigate", keywords: ["fixtures", "matches", "rounds", "schedule"] },
    { id: "nav-teams", label: "Teams", description: "Team registry and detail", href: `${prefix}/teams`, category: "navigate", keywords: ["teams", "squad"] },
    { id: "nav-players", label: "Players", description: "Player registry and profiles", href: `${prefix}/players`, category: "navigate", keywords: ["players", "registry"] },
    { id: "nav-season", label: "Season", description: "Season matrix and fairness", href: `${prefix}/season`, category: "navigate", keywords: ["season", "matrix", "fairness"] },
    { id: "nav-rules", label: "Rules", description: "Selection rules and rotation paths", href: `${prefix}/rules`, category: "navigate", keywords: ["rules", "config", "paths"] },
    { id: "nav-events", label: "Events", description: "Event squads and planning", href: `${prefix}/events`, category: "navigate", keywords: ["events", "cups", "tournaments"] },
  ];

  if (canCreate) {
    commands.push(
      { id: "create-team", label: "Create team", description: "Add a new team", href: `${prefix}/teams/new`, category: "create", keywords: ["create", "new", "add", "team"] },
      { id: "create-player", label: "Create player", description: "Add a new player", href: `${prefix}/players/new`, category: "create", keywords: ["create", "new", "add", "player"] },
      { id: "create-fixture", label: "Create fixture", description: "Add a new match", href: `${prefix}/matches/new`, category: "create", keywords: ["create", "new", "add", "match", "fixture"] },
      { id: "create-event", label: "Create event", description: "Add a new event", href: `${prefix}/events/new`, category: "create", keywords: ["create", "new", "add", "event", "cup", "tournament"] },
      { id: "create-league-season", label: "Create league season", description: "Set up a new league season for planning", href: `${prefix}/season/new`, category: "create", keywords: ["create", "new", "add", "season", "league", "spring", "fall"] },
    );
  }

  if (canManageOrg) {
    commands.push(
      { id: "nav-simulation", label: "Simulation", description: "Run season simulation", href: `${prefix}/simulation`, category: "navigate", keywords: ["simulation", "dry-run", "plan"] },
      { id: "nav-workbench", label: "Policy workbench", description: "Policy evaluation workbench", href: `${prefix}/workbench`, category: "navigate", keywords: ["workbench", "policy", "rego"] },
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