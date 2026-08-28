import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/docs/source";

/**
 * Public documentation search (ADR-0103). Indexes only canonical docs content
 * (content/docs/**) via the shared `source` loader -- never application/tenant
 * data. Query options (locale/tag/limit) are bounded by fumadocs-core itself.
 */
export const { GET } = createFromSource(source);
