"use client";

import { useEffect, useState } from "react";
import { Download, Share, CheckCircle2 } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

/**
 * InstallPwaCard — platform-aware "Install Matchboard" entry (PROGRAMME.md
 * §42). Android/Chromium gets a real `beforeinstallprompt` trigger; iOS has
 * no programmatic install API, so it gets static Home Screen instructions
 * instead. Renders nothing if already installed or if neither path applies
 * (unsupported browser, or the prompt hasn't fired yet this session).
 */
export function InstallPwaCard() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIOS());

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
  }, []);

  if (installed) {
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

  if (installEvent) {
    return (
      <Surface variant="subtle" padding="md" className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Install Matchboard</p>
          <p className="text-xs text-[var(--text-muted)]">
            Add Matchboard to your home screen for quick access.
          </p>
        </div>
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
      </Surface>
    );
  }

  if (ios) {
    return (
      <Surface variant="subtle" padding="md" className="flex items-start gap-3">
        <Share className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">Install Matchboard</p>
          <p className="text-xs text-[var(--text-muted)]">
            Tap the Share icon, then &quot;Add to Home Screen&quot;.
          </p>
        </div>
      </Surface>
    );
  }

  return null;
}
