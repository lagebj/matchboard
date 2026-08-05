import { Suspense } from "react";
import { requireActorContext } from "@/lib/auth/actor-context";
import { FixturesPage } from "@/components/fixtures/fixtures-page";

export default async function FixturesRoute({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requireActorContext(orgSlug);

  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading fixtures...</div>}>
      <FixturesPage orgSlug={orgSlug} />
    </Suspense>
  );
}