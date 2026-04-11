import { saveRulesAction } from "@/app/rules/actions";
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
    <section className="border border-zinc-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function CheckboxField({
  defaultChecked,
  description,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-3 border border-zinc-200 p-3">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-950">{label}</span>
        <span className="text-sm text-zinc-600">{description}</span>
      </span>
    </label>
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
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        className="h-10 border border-zinc-300 bg-white px-3 font-normal"
        defaultValue={defaultValue}
        min={0}
        name={name}
        required
        type="number"
      />
      <span className="text-sm font-normal text-zinc-600">{description}</span>
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
        <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          Rule configuration saved.
        </div>
      ) : null}

      <RuleSection
        title="Core Match Drop"
        description="Controls for when marked players may skip one core-team match."
      >
        <CheckboxField
          defaultChecked={rules.allowCoreMatchDrop}
          description="Allow marked players to skip a core-team match when the drop rule applies."
          label="Allow core-match drop"
          name="allowCoreMatchDrop"
        />
        <NumberField
          defaultValue={rules.maxCoreMatchDropsPerPlayer}
          description="Maximum number of inferred dropped core-team matches allowed per marked player."
          label="Max core-match drops per player"
          name="maxCoreMatchDropsPerPlayer"
        />
      </RuleSection>

      <RuleSection
        title="Floating"
        description="Controls for repeated floating usage and nearby floating history."
      >
        <NumberField
          defaultValue={rules.maxTotalFloatMatches}
          description="Maximum number of finalized floating matches allowed per player."
          label="Max total floating matches"
          name="maxTotalFloatMatches"
        />
        <CheckboxField
          defaultChecked={rules.preventConsecutiveFloat}
          description="Block players from floating again immediately after a finalized floating appearance."
          label="Prevent consecutive floating"
          name="preventConsecutiveFloat"
        />
        <NumberField
          defaultValue={rules.blockCoreMatchIfFloatingWithinDays}
          description="Block a nearby core-team match when the player already has a finalized floating match inside this window."
          label="Block core match after float within days"
          name="blockCoreMatchIfFloatingWithinDays"
        />
      </RuleSection>

      <RuleSection
        title="Match Spacing"
        description="Minimum spacing between finalized appearances for the same player."
      >
        <NumberField
          defaultValue={rules.minDaysBetweenAnyMatches}
          description="Minimum full-day gap required between any finalized matches for the same player."
          label="Min days between matches"
          name="minDaysBetweenAnyMatches"
        />
      </RuleSection>

      <RuleSection
        title="Preferences"
        description="Soft preferences the engine can use when choosing between otherwise valid candidates."
      >
        <CheckboxField
          defaultChecked={rules.preferPositionBalance}
          description="Prefer combinations that keep squad positions more balanced."
          label="Prefer positional balance"
          name="preferPositionBalance"
        />
        <CheckboxField
          defaultChecked={rules.preferLowRecentLoad}
          description="Prefer players with lower recent finalized match load when choices are otherwise similar."
          label="Prefer low recent load"
          name="preferLowRecentLoad"
        />
        <CheckboxField
          defaultChecked={rules.preferLowerFloatCount}
          description="Prefer players with fewer prior floating appearances when candidates are otherwise similar."
          label="Prefer lower float count"
          name="preferLowerFloatCount"
        />
      </RuleSection>

      <div className="flex">
        <button
          className="h-10 rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
          type="submit"
        >
          Save rules
        </button>
      </div>
    </form>
  );
}
