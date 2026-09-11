"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { DueDecisionReviewCard } from "@/lib/assistant/types";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { TouchlineButton } from "@/components/touchline";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import {
  resolveDecisionReviewAction,
  deferDecisionReviewAction,
} from "@/app/(app)/o/[orgSlug]/reviews/decision-review-actions";

/**
 * Due Decision reviews (ADR-0131 / ADR-0132) under "Needs attention" on Today, after immediate
 * live/matchday items. Attention, not an error — no danger tone, no blocker semantics.
 *
 * Actions: Keep / Change / Complete / Later. "Change" resolves CHANGE and opens the target's
 * detail page for the edit. Nothing auto-resolves.
 */
export function DueDecisionReviewSection({ reviews }: { reviews: DueDecisionReviewCard[] }) {
  if (reviews.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Ready to revisit"
        description="Coaching decisions worth a fresh look now that time has passed."
        eyebrow={`${reviews.length} decision review${reviews.length === 1 ? "" : "s"}`}
      />
      <ul className="flex flex-col divide-y divide-[var(--border-soft)]">
        {reviews.map((review) => (
          <DecisionReviewRow key={review.reviewId} review={review} />
        ))}
      </ul>
    </Surface>
  );
}

function DecisionReviewRow({ review }: { review: DueDecisionReviewCard }) {
  const orgUrl = useOrgUrl();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  const keep = () =>
    run(() =>
      resolveDecisionReviewAction(review.reviewId, "KEEP", {
        targetType: review.targetType,
        targetId: review.targetId,
      }),
    );

  const change = () =>
    run(async () => {
      await resolveDecisionReviewAction(review.reviewId, "CHANGE", {
        targetType: review.targetType,
        targetId: review.targetId,
      });
      router.push(orgUrl(review.targetHref));
    });

  const complete = () =>
    run(() =>
      resolveDecisionReviewAction(review.reviewId, "COMPLETE", {
        targetType: review.targetType,
        targetId: review.targetId,
      }),
    );

  const later = () => run(() => deferDecisionReviewAction(review.reviewId));

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[var(--text-micro)] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {review.label}
        </span>
        <span className="text-[var(--text-meta)] text-[var(--text-muted)]">
          {review.targetName} · scheduled {review.ageDays} day{review.ageDays === 1 ? "" : "s"} ago
        </span>
      </div>
      <p className="text-[var(--text-row-title)] text-[var(--foreground)]">{review.decisionText}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <TouchlineButton size="sm" variant="primary" onClick={keep} disabled={pending}>
          Keep
        </TouchlineButton>
        <TouchlineButton size="sm" variant="secondary" onClick={change} disabled={pending}>
          Change
        </TouchlineButton>
        <TouchlineButton size="sm" variant="ghost" onClick={complete} disabled={pending}>
          Complete
        </TouchlineButton>
        <TouchlineButton
          size="sm"
          variant="ghost"
          onClick={later}
          disabled={pending}
          leadingIcon={<RefreshCw className="h-3 w-3" aria-hidden="true" />}
        >
          Later
        </TouchlineButton>
      </div>
      {error && <p className="text-[var(--text-meta)] text-[var(--danger)]">{error}</p>}
    </li>
  );
}
