import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function RoundReviewRedirect({ params }: { params: Promise<{ matchRoundId: string }> }) {
  const { matchRoundId } = await params;
  return redirectToOrgSlug(`/rounds/${matchRoundId}/review`);
}