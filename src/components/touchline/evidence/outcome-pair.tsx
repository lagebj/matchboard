import { cn } from "@/lib/cn";

/**
 * OutcomePair (bundle `08_EVIDENCE_STORY_GRAMMAR.md §7`).
 *
 * Two additive/comparable outcomes on one scale — e.g. goals scored vs conceded
 * while a combination is on the field. Neutral foreground + secondary evidence
 * accent, never good/bad colours. Renders a visually-hidden text equivalent.
 */
type Props = {
  question: string;
  forLabel: string;
  forValue: number;
  againstLabel: string;
  againstValue: number;
  className?: string;
};

export function OutcomePair({
  question,
  forLabel,
  forValue,
  againstLabel,
  againstValue,
  className,
}: Props) {
  const total = Math.max(1, forValue + againstValue);
  const forPct = (forValue / total) * 100;

  return (
    <figure className={cn("flex flex-col gap-1.5", className)} aria-label={question}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--border-strong)]">
        <div className="h-full bg-[var(--tl-c-evidence)]" style={{ width: `${forPct}%` }} />
      </div>
      <figcaption className="sr-only">
        {forLabel}: {forValue}. {againstLabel}: {againstValue}.
      </figcaption>
    </figure>
  );
}
