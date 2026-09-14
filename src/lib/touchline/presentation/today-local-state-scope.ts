/**
 * Opaque client scope for Today's browser-local `localStorage` keys (ADR-0141,
 * `04_BROWSER_LOCAL_STATE.md`). Never expose raw organisation/member ids in a `localStorage` key
 * — this is a one-way hash, not a lookup, so the key on disk cannot be reversed to an
 * organisation or membership.
 */

import { createHash } from "node:crypto";

export function getTodayLocalStateScope(organisationId: string, membershipId: string): string {
  return createHash("sha256").update(`today-v1|${organisationId}|${membershipId}`).digest("hex").slice(0, 24);
}
