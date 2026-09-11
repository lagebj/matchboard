import type { ReactNode } from "react";
import { EvidenceStory } from "@/components/touchline/evidence/evidence-story";

/**
 * EvidenceSpotlightWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * One engine-supported story: observation, sample, confidence, one visualization, detail link.
 * A named wrapper over the existing `EvidenceStory` primitive (already satisfies every field this
 * widget requires) — kept as its own file so route composition can import the semantic name the
 * Atlas bundle specifies without a second implementation.
 */
export type EvidenceSpotlightWidgetProps = {
  question: string;
  label: string;
  title: string;
  value?: ReactNode;
  valueCaption?: string;
  visual?: ReactNode;
  sample?: string;
  confidence?: string | null;
  interpretation?: string;
  detailHref?: string;
  detailLabel?: string;
  className?: string;
};

export function EvidenceSpotlightWidget(props: EvidenceSpotlightWidgetProps) {
  return <EvidenceStory {...props} />;
}
