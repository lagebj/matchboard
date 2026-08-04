"use client";

import { useEffect } from "react";
import { setOrgSlugCookieAction } from "@/app/(app)/o/[orgSlug]/org-slug-actions";

export function OrgSlugCookieSetter({ orgSlug }: { orgSlug: string }) {
  useEffect(() => {
    setOrgSlugCookieAction(orgSlug);
  }, [orgSlug]);

  return null;
}
