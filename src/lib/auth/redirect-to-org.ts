import { redirect } from "next/navigation";
import { resolveOrgSlugForLayout } from "@/lib/auth/resolve-org-slug";

export async function redirectToOrgSlug(path: string): Promise<never> {
  const orgSlug = await resolveOrgSlugForLayout();
  redirect(`/o/${orgSlug}${path}`);
}