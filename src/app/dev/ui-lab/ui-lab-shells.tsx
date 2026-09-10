import type { ReactNode } from "react";
import {
  TouchlineSidebar,
  TouchlineRail,
  TouchlineBottomNav,
  TouchlineTopBar,
  type TouchlineNavKey,
} from "@/components/touchline";
import { APP_VERSION } from "@/lib/version";
import { uiLabNav, UI_LAB_ORG_CONTEXT } from "./fixtures";

function AccountChip() {
  return (
    <span className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tl-c-surface-strong)] text-[11px] font-semibold text-[var(--text-soft)]">
      LB
    </span>
  );
}

/**
 * The one adaptive UI Lab shell — mirrors the real app's three navigation tiers
 * (bundle `05_NAVIGATION_MATERIALS_AND_SHELL.md`): floating bottom nav <600px,
 * 72 px rail 600–839px, 216 px receding sidebar ≥840px. Screenshots capture it
 * at the exact golden viewport sizes so the responsive breakpoints drive the
 * layout.
 */
export function UiLabShell({
  activeKey,
  children,
  contentWidthClass = "max-w-[1180px]",
  compactPadClass = "px-4 pt-4",
}: {
  activeKey: TouchlineNavKey;
  children: ReactNode;
  contentWidthClass?: string;
  compactPadClass?: string;
}) {
  const { items, activeKey: active } = uiLabNav(activeKey);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden shrink-0 medium:block expanded:hidden">
        <div className="sticky top-0 h-screen">
          <TouchlineRail items={items} activeKey={active} />
        </div>
      </aside>
      <aside className="hidden shrink-0 expanded:block">
        <div className="sticky top-0 h-screen">
          <TouchlineSidebar items={items} activeKey={active} versionLabel={`v${APP_VERSION}`} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden medium:block">
          <TouchlineTopBar context={UI_LAB_ORG_CONTEXT} account={<AccountChip />} />
        </div>

        <main className={`flex-1 medium:px-8 medium:py-7 ${compactPadClass} tl-nav-clearance medium:pb-7`}>
          <div className={`mx-auto w-full ${contentWidthClass}`}>{children}</div>
        </main>
      </div>

      <TouchlineBottomNav items={items} activeKey={active} />
    </div>
  );
}
