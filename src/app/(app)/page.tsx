import { redirect } from "next/navigation";
import { resolveOrgSlugForLayout } from "@/lib/auth/resolve-org-slug";

export default async function RootPage() {
  const orgSlug = await resolveOrgSlugForLayout();
  redirect(`/o/${orgSlug}/today`);
}