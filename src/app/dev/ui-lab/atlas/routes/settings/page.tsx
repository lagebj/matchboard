"use client";

import { useState } from "react";
import { TouchlinePageHeader } from "@/components/touchline";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { atlasNav } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const SECTIONS = ["Appearance", "Organisation", "Team configuration", "Data & privacy", "About"] as const;
const THEMES = ["System", "Light", "Dark"] as const;

/**
 * Settings — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §D`. Side navigation on desktop.
 * Appearance: System/Light/Dark only — no arbitrary accent-color chooser (Touchline accent
 * remains product-defined, provenance §0.10). Notifications/App-device sections are omitted —
 * neither exists in the current product.
 */
export default function AtlasSettingsPage() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Appearance");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("System");

  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Settings" context="App preferences and configuration" />

      <div className="mt-5 flex flex-col gap-6 medium:flex-row">
        <div className="medium:w-[200px] shrink-0">
          <ul className="flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setSection(s)}
                  className={
                    "w-full rounded-[var(--tl-c-radius-control)] px-3 py-2 text-left text-[13px] " +
                    (s === section ? "bg-[var(--tl-c-surface-selected)] font-[600] text-[var(--foreground)]" : "text-[var(--text-soft)]")
                  }
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 flex-1">
          {section === "Appearance" ? (
            <TouchlineWidget>
              <WidgetHeader eyebrow="Appearance" title="Theme" />
              <div className="mt-3 flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={
                      "rounded-[var(--tl-c-radius-control)] border px-3.5 py-2 text-[13px] font-[600] " +
                      (t === theme ? "border-[var(--accent)] bg-[var(--tl-widget-strong)] text-[var(--foreground)]" : "border-[var(--border-soft)] text-[var(--text-muted)]")
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </TouchlineWidget>
          ) : (
            <TouchlineWidget>
              <WidgetHeader eyebrow={section} title="Not part of this fixture set" />
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">Composition placeholder for the {section} section.</p>
            </TouchlineWidget>
          )}
        </div>
      </div>
    </UiLabShell>
  );
}
