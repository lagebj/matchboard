import type { ActorContext } from "@/lib/auth/actor-context";

export type CommandCategory = "navigate" | "create" | "switch" | "admin" | "search";

/**
 * Canonical command registry entry (PROGRAMME.md §13, UI/UX programme Phase 2.6). Every global
 * command the palette -- or any future consumer, e.g. a bulk toolbar or context menu -- can
 * offer is declared once in `registry.ts`, not inline inside the rendering component or its API
 * route.
 *
 * `availability` is the server-side authorization-aware gate. It runs against a real
 * `ActorContext` -- the same context every protected page/action already uses -- so a command a
 * role can't use is never even sent to the client. Client-side keyword/search filtering
 * (`command-palette.tsx`) is a UX layer on top of this; it never substitutes for it.
 *
 * Contextual commands (current route/entity, PROGRAMME.md §15) and selection-aware commands
 * (§16) are deliberately not modelled here yet -- this registry only holds context-free global
 * commands (navigate/create/admin). Extending `availability`'s signature to take route/entity/
 * selection context is the natural next step once a real contextual or selection-aware command
 * exists to justify it; adding an unused parameter now would be speculative.
 */
export type CommandDefinition = {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  keywords: string[];
  href: (context: ActorContext) => string;
  availability: (context: ActorContext) => boolean;
};

/** What the API route sends to the client: same shape, `href` already resolved. */
export type ResolvedCommand = {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  keywords: string[];
  href: string;
};
