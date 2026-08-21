import { canAdmin, canMutate, type ActorContext } from "@/lib/auth/actor-context";
import type { CommandDefinition, ResolvedCommand } from "@/lib/commands/types";

/**
 * The canonical command registry (PROGRAMME.md §13). Add new global commands here, not inline
 * in the palette component or its API route -- both `src/app/api/command-palette/route.ts` and
 * any future consumer resolve availability from this one list.
 */
export const COMMAND_REGISTRY: CommandDefinition[] = [
  {
    id: "nav-today",
    label: "Today",
    description: "Next actions and blockers",
    category: "navigate",
    keywords: ["today", "assistant", "dashboard", "home"],
    href: (ctx) => `/o/${ctx.organisationSlug}/today`,
    availability: () => true,
  },
  {
    id: "nav-league",
    label: "League",
    description: "Season and match overview",
    category: "navigate",
    keywords: ["league", "fixtures", "matches", "rounds", "schedule"],
    href: (ctx) => `/o/${ctx.organisationSlug}/fixtures`,
    availability: () => true,
  },
  {
    id: "nav-teams",
    label: "Teams",
    description: "League team registry and detail",
    category: "navigate",
    keywords: ["teams", "squad", "league"],
    href: (ctx) => `/o/${ctx.organisationSlug}/teams`,
    availability: () => true,
  },
  {
    id: "nav-players",
    label: "Players",
    description: "Player registry and profiles",
    category: "navigate",
    keywords: ["players", "registry"],
    href: (ctx) => `/o/${ctx.organisationSlug}/players`,
    availability: () => true,
  },
  {
    id: "nav-events",
    label: "Events",
    description: "Event squads and planning",
    category: "navigate",
    keywords: ["events", "cups", "tournaments"],
    href: (ctx) => `/o/${ctx.organisationSlug}/events`,
    availability: () => true,
  },
  {
    id: "nav-more",
    label: "More",
    description: "Insights, opponents, groups, formations, rules",
    category: "navigate",
    keywords: ["more", "insights", "opponents", "groups", "formations", "settings"],
    href: (ctx) => `/o/${ctx.organisationSlug}/more`,
    availability: () => true,
  },
  {
    id: "nav-season",
    label: "Season",
    description: "Season matrix and fairness",
    category: "navigate",
    keywords: ["season", "matrix", "fairness"],
    href: (ctx) => `/o/${ctx.organisationSlug}/season`,
    availability: () => true,
  },
  {
    id: "nav-rules",
    label: "Rules",
    description: "Selection rules and rotation paths",
    category: "navigate",
    keywords: ["rules", "config", "paths"],
    href: (ctx) => `/o/${ctx.organisationSlug}/rules`,
    availability: () => true,
  },
  {
    id: "create-team",
    label: "Create team",
    description: "Add a new team",
    category: "create",
    keywords: ["create", "new", "add", "team"],
    href: (ctx) => `/o/${ctx.organisationSlug}/teams/new`,
    availability: (ctx) => canMutate(ctx),
  },
  {
    id: "create-player",
    label: "Create player",
    description: "Add a new player",
    category: "create",
    keywords: ["create", "new", "add", "player"],
    href: (ctx) => `/o/${ctx.organisationSlug}/players/new`,
    availability: (ctx) => canMutate(ctx),
  },
  {
    id: "create-fixture",
    label: "Create fixture",
    description: "Add a new match",
    category: "create",
    keywords: ["create", "new", "add", "match", "fixture"],
    href: (ctx) => `/o/${ctx.organisationSlug}/matches/new`,
    availability: (ctx) => canMutate(ctx),
  },
  {
    id: "create-event",
    label: "Create event",
    description: "Add a new event",
    category: "create",
    keywords: ["create", "new", "add", "event", "cup", "tournament"],
    href: (ctx) => `/o/${ctx.organisationSlug}/events/new`,
    availability: (ctx) => canMutate(ctx),
  },
  {
    id: "create-league-season",
    label: "Create league season",
    description: "Set up a new league season for planning",
    category: "create",
    keywords: ["create", "new", "add", "season", "league", "spring", "fall"],
    href: (ctx) => `/o/${ctx.organisationSlug}/season/new`,
    availability: (ctx) => canMutate(ctx),
  },
  {
    id: "nav-simulation",
    label: "Simulation",
    description: "Run season simulation",
    // Was miscategorized "navigate" before this registry existed, which meant the palette's
    // dedicated "Admin" bucket (command-palette.tsx's CATEGORY_ICONS/groupedCategories already
    // handle category "admin") was always empty -- found during the Phase 2.0 baseline audit.
    category: "admin",
    keywords: ["simulation", "dry-run", "plan"],
    href: (ctx) => `/o/${ctx.organisationSlug}/simulation`,
    availability: (ctx) => canAdmin(ctx),
  },
  {
    id: "nav-workbench",
    label: "Policy workbench",
    description: "Policy evaluation workbench",
    category: "admin",
    keywords: ["workbench", "policy", "rego"],
    href: (ctx) => `/o/${ctx.organisationSlug}/workbench`,
    availability: (ctx) => canAdmin(ctx),
  },
];

/** Resolve the registry against a real actor context: filter by availability, then bind href. */
export function getAvailableCommands(context: ActorContext): ResolvedCommand[] {
  return COMMAND_REGISTRY.filter((command) => command.availability(context)).map((command) => ({
    id: command.id,
    label: command.label,
    description: command.description,
    category: command.category,
    keywords: command.keywords,
    href: command.href(context),
  }));
}
