import { saveRulesAction } from "@/app/(app)/rules/actions";
import { TouchlineButton } from "@/components/touchline";
import type { MatchboardRuleConfig } from "@/lib/rules/get-rules";

function RuleSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
        <p className="mt-1 text-sm app-copy-soft">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function NumberField({
  defaultValue,
  description,
  label,
  name,
}: {
  defaultValue: number;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] p-4 text-sm font-medium text-[var(--foreground)]">
      <span>{label}</span>
      <input
        className="h-10 rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] px-3 font-normal text-[var(--foreground)]"
        defaultValue={defaultValue}
        min={0}
        name={name}
        required
        type="number"
      />
      <span className="text-sm font-normal app-copy-soft">{description}</span>
    </label>
  );
}

export function RulesForm({
  rules,
  saved,
}: {
  rules: MatchboardRuleConfig;
  saved: boolean;
}) {
  return (
    <form action={saveRulesAction} className="flex flex-col gap-6">
      {saved ? (
        <div className="rounded-[var(--tl-c-radius-object)] border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] px-4 py-3 text-sm text-[var(--foreground)]">
          Rule configuration saved.
        </div>
      ) : null}

      <RuleSection
        title="Match Spacing"
        description="Minimum spacing between finalised appearances for the same player."
      >
        <NumberField
          defaultValue={rules.minDaysBetweenAnyMatches}
          description="Minimum full-day gap required between any finalised matches for the same player."
          label="Min days between matches"
          name="minDaysBetweenAnyMatches"
        />
        <NumberField
          defaultValue={rules.warningThreshold}
          description="Maximum warnings before human review is required for a round."
          label="Warning threshold"
          name="warningThreshold"
        />
      </RuleSection>

      <div className="flex">
        <TouchlineButton type="submit" variant="primary">
          Save rules
        </TouchlineButton>
      </div>
    </form>
  );
}