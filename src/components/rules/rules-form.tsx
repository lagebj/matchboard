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
    <section className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
        <p className="mt-1 text-sm app-copy-soft">{description}</p>
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
    <label className="flex items-start gap-3 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
      <input defaultChecked={defaultChecked} name={name} type="checkbox" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-100">{label}</span>
        <span className="text-sm app-copy-soft">{description}</span>
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
    <label className="flex flex-col gap-2 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] p-4 text-sm font-medium text-zinc-100">
      <span>{label}</span>
      <input
        className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 font-normal text-zinc-50"
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
        <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
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
          className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          type="submit"
        >
          Save rules
        </button>
      </div>
    </form>
  );
}
