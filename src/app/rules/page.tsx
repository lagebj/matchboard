export const dynamic = "force-dynamic";

import Link from "next/link";
import { RulesForm } from "@/components/rules/rules-form";
import { getRules } from "@/lib/rules/get-rules";
import { validateRuleConfig } from "@/lib/rules/validate-rules";

type RulesPageProps = {
  searchParams: Promise<{
    error?: string;
    imported?: string;
    saved?: string;
  }>;
};

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const rules = await getRules();
  const { error, imported, saved } = await searchParams;
  const validation = validateRuleConfig(rules);

  const hardLimitCards = [
    {
      label: "Spacing",
      value: `${rules.minDaysBetweenAnyMatches}d`,
      note: "Minimum gap between finalized appearances for the same player.",
    },
    {
      label: "Rule version",
      value: `v${rules.version}`,
      note: "Current rule configuration version. Finalized rounds reference the version at the time of finalization.",
    },
    {
      label: "Warning threshold",
      value: String(rules.warningThreshold),
      note: "Maximum warnings before human review is required for a round.",
    },
  ];

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Rules
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Selection rules, support priority, and squad repair behavior.
            </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                  Rules
                </h1>
                <p className="mt-4 max-w-2xl text-sm app-copy-soft sm:text-base">
                  Selection rules, support priority, and squad repair behavior.
                </p>
              </div>

              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.035)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Current posture
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">Rule version {rules.version}</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Finalized rounds reference the rule version at the time of finalization.
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                    <p className="text-sm font-medium text-zinc-100">
                      {rules.minDaysBetweenAnyMatches}-day minimum gap between matches
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Spacing limit between finalized appearances.
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
              Notes
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

          <section className="app-panel rounded-[1.75rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Import/Export
            </p>
            <p className="mt-2 text-sm app-copy-soft">Export the current rule configuration or import a new one.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-10 items-center rounded-full border border-[rgba(106,153,219,0.32)] bg-[rgba(106,153,219,0.12)] px-4 text-sm font-medium text-[#8bb8f0] hover:bg-[rgba(106,153,219,0.18)]"
                href="/api/rules"
                download
              >
                Export rules
              </Link>
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="#rule-import-section"
              >
                Import rules
              </Link>
            </div>
          </section>
        </aside>
      </section>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Rule Validation
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Configuration check</h2>

          <div className="mt-4 flex flex-col gap-3">
            {validation.errors.map((err) => (
              <div key={err.code} className="rounded-[1.3rem] border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-4 py-3">
                <p className="text-sm font-semibold text-[#f0cbc5]">{err.field}: {err.message}</p>
              </div>
            ))}
            {validation.warnings.map((warn) => (
              <div key={warn.code} className="rounded-[1.3rem] border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.06)] px-4 py-3">
                <p className="text-sm text-[var(--warning)]">{warn.field}: {warn.message}</p>
              </div>
            ))}
            {validation.errors.length === 0 && validation.warnings.length === 0 && (
              <div className="rounded-[1.3rem] border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.08)] px-4 py-3">
                <p className="text-sm text-[var(--accent-strong)]">No errors or warnings. Current rule configuration passes validation.</p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)]">
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Configuration
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
      </section>

      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
            {error}
          </div>
        ) : null}
        {imported ? (
          <div className="rounded-2xl border border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-zinc-100">
            Rules imported successfully.
          </div>
        ) : null}
      </div>

      <section id="rule-import-section" className="app-panel rounded-[1.75rem] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Import Rules
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-50">Upload a rule configuration file</h2>
        <p className="mt-2 text-sm app-copy-soft">Paste or upload a previously exported rule configuration JSON. The system validates the configuration before applying.</p>

        <div className="mt-6">
          <form action="/api/rules" method="POST" className="flex flex-col gap-4">
            <textarea
              name="rulesJson"
              rows={6}
              placeholder="Paste rule configuration JSON here..."
              className="rounded-[1.2rem] border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[rgba(106,153,219,0.3)] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border border-[rgba(106,153,219,0.32)] bg-[rgba(106,153,219,0.12)] px-4 text-sm font-medium text-[#8bb8f0] hover:bg-[rgba(106,153,219,0.18)]"
            >
              Validate and import
            </button>
          </form>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <RulesForm rules={rules} saved={saved === "1"} />
      </section>
    </main>
  );
}