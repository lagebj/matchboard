import { Suspense } from "react";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { FixturesPage } from "@/components/fixtures/fixtures-page";

export default async function FixturesRoute({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);

  return (
    <Suspense fallback={<div className="p-4 text-sm text-[var(--text-muted)]">Loading fixtures...</div>}>
      <FixturesPage orgSlug={orgSlug} />
    </Suspense>
  );
}