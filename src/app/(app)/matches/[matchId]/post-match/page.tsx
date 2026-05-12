import { Suspense } from "react";
import { PostMatchPage } from "@/components/assistant/post-match-page";

type PostMatchRouteProps = {
  params: Promise<{ matchId: string }>;
};

export default async function PostMatchRoute({ params }: PostMatchRouteProps) {
  const { matchId } = await params;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading post-match report...</div>}>
      <PostMatchPage matchId={matchId} />
    </Suspense>
  );
}