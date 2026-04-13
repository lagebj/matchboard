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

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
        <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Rules Control Room
              </span>
              <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
                Pass 8 workflow
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
                Tune the engine in the same calm workspace as the rest of the app.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 app-copy-soft sm:text-base">
                These settings do not invent match behavior on their own. They adjust the thresholds
                and toggles the selection engine already respects, so the page should read like a control room, not a generic settings form.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Core Drops
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {rules.allowCoreMatchDrop ? "On" : "Off"}
                </p>
                <p className="mt-2 text-sm app-copy-soft">
                  Current toggle for inferred core-match drops.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Float Cap
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{rules.maxTotalFloatMatches}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Maximum finalized floating matches currently allowed per player.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Match Spacing
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{rules.minDaysBetweenAnyMatches}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Minimum gap in days between finalized appearances.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Active Preferences
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">{enabledPreferenceCount}</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Soft preference toggles currently enabled.
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="app-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Rule Notes
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">How to treat this page</h2>
            </div>

            <div className="rounded-2xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-sm font-medium text-zinc-100">This page edits thresholds, not behavior definitions.</p>
              <p className="mt-2 text-sm app-copy-soft">
                The feature file still defines the behavioral source of truth. These values only tune the runtime rule config the engine applies.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Hard limits and soft preferences are different.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  Spacing, float caps, and blocking windows are thresholds. Preferences only break ties among otherwise valid candidates.
                </p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Change one idea at a time.</p>
                <p className="mt-1 text-sm app-copy-soft">
                  This page is easiest to reason about when you adjust a single lever, then review the next generated selection against history.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[var(--foreground)]">
            {error}
          </div>
        ) : null}

        <RulesForm rules={rules} saved={saved === "1"} />
      </div>
    </main>
  );
}
