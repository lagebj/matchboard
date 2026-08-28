import Link from "fumadocs-core/link";
import type { ComponentProps } from "react";

/**
 * Cross-links inside `content/docs/**` MDX prose are authored against the canonical `/docs/**`
 * paths (e.g. `[Squad planning](/docs/squad-planning)`) -- correct for the full site, but a
 * plain click on one from inside the Help drawer's `/docs/embed/**` iframe would navigate the
 * iframe to the full page, reintroducing DocsLayout's sidebar/top-nav chrome inside the narrow
 * panel. Rewrites same-origin `/docs/**` hrefs to their `/docs/embed/**` equivalent so browsing
 * cross-references stays inside the compact embed; external links and anchors pass through
 * unchanged.
 */
export function EmbedLink(props: ComponentProps<typeof Link>) {
  const href = props.href;
  if (typeof href === "string" && href.startsWith("/docs/") && !href.startsWith("/docs/embed/")) {
    return <Link {...props} href={`/docs/embed${href.slice("/docs".length)}`} />;
  }
  return <Link {...props} />;
}
