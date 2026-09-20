import "server-only";

/**
 * Single side-effect import point that registers every implemented `AiCapabilityHandler`
 * (`jobs/capability-handler.ts`'s registry). Anything that needs a capability handler to exist
 * before it runs — the cron route (`/api/cron/ai`) and domain triggers (`jobs/triggers.ts`)
 * alike — imports this module first rather than reaching into `context/*.ts` files directly, so
 * neither has to be updated when a new capability's context builder lands; only this file does.
 */
import "@/lib/ai/context/post-match-review";
import "@/lib/ai/context/round-review";
import "@/lib/ai/context/lineup-review";
