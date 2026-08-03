import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function resolveOrgSlugForLayout(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/api/auth/signin");
  }

  const memberships = await db.organisationMembership.findMany({
    where: { userId },
    select: {
      organisationId: true,
      role: true,
      expiresAt: true,
      organisation: {
        select: { id: true, slug: true, suspendedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  const eligible = memberships.filter((m) => {
    if (m.organisation.suspendedAt !== null) return false;
    if (m.role === "SUPPORT" && m.expiresAt && m.expiresAt < now) return false;
    return true;
  });

  if (eligible.length === 0) {
    redirect("/organisations");
  }

  if (eligible.length > 1) {
    redirect("/organisations");
  }

  return eligible[0].organisation.slug;
}