"use client";

import { useState } from "react";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { MetricStrip } from "@/components/touchline/widget/metric-strip";
import { atlasNav, groupSummary, playerRoster } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

const TABS = ["Members", "Pool", "Guest players", "Teams"] as const;

/**
 * Groups — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §B`. No invented group-role
 * categories — member/pool/guest/coach counts only, the real existing vocabulary.
 */
export default function AtlasGroupsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Members");

  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[900px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title={groupSummary.name} context="Group workspace" actions={<TouchlineButton variant="secondary">Edit</TouchlineButton>} />

      <div className="mt-4">
        <MetricStrip
          items={[
            { id: "members", label: "Members", value: String(groupSummary.memberCount) },
            { id: "pool", label: "Pool", value: String(groupSummary.poolCount) },
            { id: "guests", label: "Guests", value: String(groupSummary.guestCount) },
            { id: "coaches", label: "Coaches", value: String(groupSummary.coachCount) },
          ]}
        />
      </div>

      <div className="mt-4 flex gap-5 border-b border-[var(--border-soft)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={"relative shrink-0 pb-2.5 text-[14px] font-[600] " + (tab === t ? "text-[var(--foreground)]" : "text-[var(--text-muted)]")}
          >
            {t}
            {tab === t ? <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full bg-[var(--accent)]" /> : null}
          </button>
        ))}
      </div>

      <ul className="mt-4 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
        {playerRoster.map((p) => (
          <li key={p.playerId} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="text-[var(--foreground)]">{p.displayName}</span>
            <span className="text-[var(--text-muted)]">{p.coreTeamName}</span>
          </li>
        ))}
      </ul>
    </UiLabShell>
  );
}
