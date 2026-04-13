import { RulesForm } from "@/components/rules/rules-form";
import { getRules } from "@/lib/rules/get-rules";

type RulesPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const rules = await getRules();
  const { error, saved } = await searchParams;

  const enabledPreferenceCount = [
    rules.preferPositionBalance,
    rules.preferLowRecentLoad,
    rules.preferLowerFloatCount,
  ].filter(Boolean).length;

  const hardLimitCards = [
    {
      label: "Core drops",
      value: rules.allowCoreMatchDrop ? "On" : "Off",
      note: `Max ${rules.maxCoreMatchDropsPerPlayer} inferred core-match drop(s) per marked player.`,
    },
    {
      label: "Float cap",
      value: String(rules.maxTotalFloatMatches),
      note: "Maximum finalized floating matches allowed per player.",
    },
    {
      label: "Spacing",
      value: `${rules.minDaysBetweenAnyMatches}d`,
      note: "Minimum gap between finalized appearances for the same player.",
    },
    {
      label: "Float block",
      value: `${rules.blockCoreMatchIfFloatingWithinDays}d`,
      note: "Nearby core match block window after a finalized floating appearance.",
    },
  ];

  const preferenceCards = [
    {
      enabled: rules.preferPositionBalance,
      label: "Position balance",
      note: "Break ties by protecting squad shape and role coverage.",
    },
    {
      enabled: rules.preferLowRecentLoad,
      label: "Recent load",
      note: "Break ties by protecting players carrying more recent minutes.",
    },
    {
      enabled: rules.preferLowerFloatCount,
      label: "Float count",
      note: "Break ties by spreading floating duty more evenly.",
    },
  ];

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Rules Control Room
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Runtime tuning, not behavior invention
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  Tune the engine with operational consequences visible before the form.
                </h1>
                <p className="mt-4 max-w-2xl text-sm app-copy-soft sm:text-base">
                  Change the limits carefully. The form is below.
                </p>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Current posture
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">{enabledPreferenceCount} preference toggle(s) enabled</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Preferences only break ties.
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">
                      {rules.preventConsecutiveFloat ? "Consecutive floating blocked" : "Consecutive floating allowed"}
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Directly shapes repeat floating.
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">
                      {rules.allowCoreMatchDrop ? "Marked players may skip one core match" : "Marked players cannot skip core matches"}
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Direct policy choice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Control Notes
            </p>
            <div className="mt-4 grid gap-3">
              {[
                "The feature file still defines behavior. This page only edits thresholds and tie-break preferences.",
                "Hard limits should change sparingly because they can invalidate large parts of the candidate pool.",
                "Soft preferences are safest to tweak when you want better tie-break behavior without changing eligibility.",
              ].map((note) => (
                <div
                  key={note}
                  className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm leading-6 app-copy-soft"
                >
                  {note}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Hard Limits
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">These values block or allow candidate sets outright</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {hardLimitCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{card.value}</p>
                <p className="mt-2 text-sm leading-6 app-copy-soft">{card.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Soft Preferences
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">These only shape tie-breaks among valid options</h2>
          <div className="mt-6 grid gap-4">
            {preferenceCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[1.45rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-100">{card.label}</p>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                      card.enabled
                        ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                        : "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]"
                    }`}
                  >
                    {card.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 app-copy-soft">{card.note}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
            {error}
          </div>
        ) : null}
      </div>

      <section className="app-panel rounded-[1.75rem] p-6">
        <RulesForm rules={rules} saved={saved === "1"} />
      </section>
    </main>
  );
}
