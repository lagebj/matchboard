import { TouchlinePageHeader } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

function StateCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p>
      {children}
    </div>
  );
}

/**
 * System states gallery — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §I`. Shared state
 * components rendered together for review, in the current theme (page inherits system/light/dark
 * from the shell, same as every other route — no separate forced theme).
 */
export default function AtlasSystemStatesPage() {
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[1000px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="System states" context="Shared interaction/feedback states" />

      <div className="mt-5 grid grid-cols-1 gap-4 medium:grid-cols-3">
        <StateCard label="Loading">
          <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--tl-widget-strong)]" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[var(--tl-widget-strong)]" />
        </StateCard>

        <StateCard label="Empty">
          <p className="text-[13px] text-[var(--text-muted)]">No players yet. Add a player.</p>
        </StateCard>

        <StateCard label="Error">
          <p className="text-[13px] text-[var(--danger)]">Something went wrong loading this page.</p>
        </StateCard>

        <StateCard label="Attention">
          <p className="rounded-[var(--tl-c-radius-control)] bg-[var(--warning-subtle)] px-3 py-2 text-[13px] text-[var(--warning)]">
            Available player without planned match opportunity
          </p>
        </StateCard>

        <StateCard label="Warning">
          <p className="rounded-[var(--tl-c-radius-control)] bg-[var(--danger-subtle)] px-3 py-2 text-[13px] text-[var(--danger)]">
            Squad below minimum accepted size
          </p>
        </StateCard>

        <StateCard label="Live">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--live)]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
            LIVE · 34&apos;
          </span>
        </StateCard>

        <StateCard label="Selected">
          <div className="rounded-[var(--tl-c-radius-control)] bg-[var(--tl-c-surface-selected)] px-3 py-2 text-[13px] font-[600] text-[var(--foreground)]">
            Noah Larsen
          </div>
        </StateCard>

        <StateCard label="Disabled">
          <button type="button" disabled className="rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] px-3 py-2 text-[13px] text-[var(--text-disabled)] opacity-45">
            Complete report
          </button>
        </StateCard>

        <StateCard label="Focus visible">
          <button type="button" className="rounded-[var(--tl-c-radius-control)] border border-[var(--accent)] px-3 py-2 text-[13px] text-[var(--foreground)] outline outline-2 outline-offset-2 outline-[var(--focus)]">
            Save
          </button>
        </StateCard>

        <StateCard label="Insufficient evidence">
          <p className="text-[13px] text-[var(--text-muted)]">Not enough evidence yet.</p>
        </StateCard>

        <StateCard label="No safe positional fit">
          <p className="rounded-[var(--tl-c-radius-control)] bg-[var(--warning-subtle)] px-3 py-2 text-[13px] text-[var(--warning)]">
            No safe replacement for CB at 42 min
          </p>
        </StateCard>

        <StateCard label="Bottom sheet">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)]" />
          <p className="mt-3 text-[13px] text-[var(--text-muted)]">Select a player</p>
        </StateCard>
      </div>

      <div className="mt-6">
        <TouchlineWidget>
          <WidgetHeader title="Note" />
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">
            This page renders in whatever theme (system/light/dark) is currently active — toggle
            it via Settings → Appearance to review both palettes.
          </p>
        </TouchlineWidget>
      </div>
    </UiLabShell>
  );
}
