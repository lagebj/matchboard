"use client";

import { useEffect, useState } from "react";
import { Download, Share, CheckCircle2, Menu, X } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_STORAGE_KEY = "matchboard:pwa-install-dismissed";

function isStandalone(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's non-standard standalone flag — no `display-mode` media
    // query support there.
    navigatorWithStandalone.standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — dismiss is a soft
    // preference, not a correctness requirement, so failing silently is fine.
  }
}

type InstallPwaCardProps = {
  /**
   * When true, the card can be dismissed (a small × control) and remembers
   * that choice in localStorage, and hides itself once already installed
   * rather than showing a confirmation. Intended for a first-visit banner
   * (e.g. /today) that shouldn't linger permanently. The More page instance
   * omits this — it stays a stable, always-present status/action card.
   */
  dismissible?: boolean;
};

/**
 * InstallPwaCard — platform-aware "Install Matchboard" entry (PROGRAMME.md
 * §42). Android/Chromium gets a real `beforeinstallprompt` trigger when the
 * browser's own engagement heuristics allow it; that heuristic cannot be
 * bypassed by the app (no API exists to force it), so every other case
 * (iOS, and any browser/timing where the prompt hasn't fired yet) gets
 * static manual instructions instead of rendering nothing — the coach
 * should always have *something* actionable here, never a silent gap.
 */
export function InstallPwaCard({ dismissible = false }: InstallPwaCardProps) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());
    if (dismissible) setDismissed(readDismissed());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [dismissible]);

  function handleDismiss() {
    writeDismissed();
    setDismissed(true);
  }

  if (dismissible && dismissed) {
    return null;
  }

  if (installed) {
    if (dismissible) {
      // Nothing actionable left for a first-visit banner once installed —
      // the More page's non-dismissible instance still shows confirmation.
      return null;
    }
    return (
      <Surface variant="subtle" padding="md" className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--success)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">Matchboard is installed</p>
          <p className="text-xs text-[var(--text-muted)]">You&apos;re using the installed app.</p>
        </div>
      </Surface>
    );
  }

  const dismissControl = dismissible ? (
    <button
      type="button"
      onClick={handleDismiss}
      aria-label="Dismiss install prompt"
      className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-white/5 hover:text-zinc-200"
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  ) : null;

  if (installEvent) {
    return (
      <Surface variant="subtle" padding="md" className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Install Matchboard</p>
          <p className="text-xs text-[var(--text-muted)]">
            Add Matchboard to your home screen for quick access.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={async () => {
              await installEvent.prompt();
              const choice = await installEvent.userChoice;
              if (choice.outcome === "accepted") setInstalled(true);
              setInstallEvent(null);
            }}
          >
            Install
          </Button>
          {dismissControl}
        </div>
      </Surface>
    );
  }

  if (ios) {
    return (
      <Surface variant="subtle" padding="md" className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Share className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-zinc-100">Install Matchboard</p>
            <p className="text-xs text-[var(--text-muted)]">
              Tap the Share icon, then &quot;Add to Home Screen&quot;.
            </p>
          </div>
        </div>
        {dismissControl}
      </Surface>
    );
  }

  // Neither installed, iOS, nor a captured beforeinstallprompt — most likely Android/desktop
  // Chromium before the browser's own engagement heuristic has allowed the native prompt, or a
  // browser without install-prompt support at all. Either way, the browser's own menu is always
  // a valid manual path, so show that rather than nothing.
  return (
    <Surface variant="subtle" padding="md" className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <Menu className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">Install Matchboard</p>
          <p className="text-xs text-[var(--text-muted)]">
            Open your browser menu and look for &quot;Install app&quot; or &quot;Add to Home screen&quot;.
          </p>
        </div>
      </div>
      {dismissControl}
    </Surface>
  );
}
