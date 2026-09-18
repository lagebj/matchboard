import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineButton } from "@/components/touchline";

/**
 * Post-Match Report "Review" tab (DRAFT only, `05_POST_MATCH_DRAFT_SPEC.md`). `/review` remains
 * the deeper planned-vs-actual/audit workflow (`08_COMPONENT_AND_ROUTE_ARCHITECTURE.md`:
 * "Preserve `/review`... Do not turn these into query tabs unless the specification explicitly
 * says so") — this tab is a compact entry point into it, not a second render of its content.
 */
export function PostMatchReviewTab({ reviewHref }: { reviewHref: string }) {
  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Plan integrity review" description="Compare the planned squad and rotations against what actually happened." />
      <TouchlineButton as={Link} href={reviewHref} variant="primary" size="md" className="self-start">
        Open review
      </TouchlineButton>
    </Surface>
  );
}
