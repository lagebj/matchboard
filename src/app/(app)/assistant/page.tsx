import { redirect } from "next/navigation";
import { resolveOrgSlugForLayout } from "@/lib/auth/resolve-org-slug";

export default async function AssistantRedirect() {
  const orgSlug = await resolveOrgSlugForLayout();
  redirect(`/o/${orgSlug}/assistant`);
}