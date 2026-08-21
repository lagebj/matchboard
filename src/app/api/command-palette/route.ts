import { NextRequest, NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
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

function getFilteredCommands(canCreate: boolean, canManageOrg: boolean, orgSlug: string): CommandItem[] {
  const prefix = `/o/${orgSlug}`;
  const commands: CommandItem[] = [
    { id: "nav-today", label: "Today", description: "Next actions and blockers", href: `${prefix}/today`, category: "navigate", keywords: ["today", "assistant", "dashboard", "home"] },
    { id: "nav-league", label: "League", description: "Season and match overview", href: `${prefix}/fixtures`, category: "navigate", keywords: ["league", "fixtures", "matches", "rounds", "schedule"] },
    { id: "nav-teams", label: "Teams", description: "League team registry and detail", href: `${prefix}/teams`, category: "navigate", keywords: ["teams", "squad", "league"] },
    { id: "nav-players", label: "Players", description: "Player registry and profiles", href: `${prefix}/players`, category: "navigate", keywords: ["players", "registry"] },
    { id: "nav-events", label: "Events", description: "Event squads and planning", href: `${prefix}/events`, category: "navigate", keywords: ["events", "cups", "tournaments"] },
    { id: "nav-more", label: "More", description: "Insights, opponents, groups, formations, rules", href: `${prefix}/more`, category: "navigate", keywords: ["more", "insights", "opponents", "groups", "formations", "settings"] },
    { id: "nav-season", label: "Season", description: "Season matrix and fairness", href: `${prefix}/season`, category: "navigate", keywords: ["season", "matrix", "fairness"] },
    { id: "nav-rules", label: "Rules", description: "Selection rules and rotation paths", href: `${prefix}/rules`, category: "navigate", keywords: ["rules", "config", "paths"] },
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