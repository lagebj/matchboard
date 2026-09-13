# PWA installation — manual verification checklist

The automated suite (`e2e/pwa-installability.spec.ts`) proves what Matchboard controls: the
manifest is reachable unauthenticated, parses with no critical errors, every icon loads, Chromium
reports nothing blocking, `start_url` resolves same-origin, and the display mode is `standalone`.
It **cannot** prove OS-level install and launch behaviour, or how a given browser paints its
install affordance. Those are checked by hand, per environment, using this list.

See ADR-0123 for the design. Run against the **Test** environment
(`https://test.matchboard.football`) — never trigger an uncontrolled Production check.

## Quick re-check of a deployed environment (any machine)

```sh
# Manifest must be 200 application/manifest+json (NOT 307 -> /signin):
curl -sI https://test.matchboard.football/manifest.webmanifest | grep -Ei '^HTTP|^location|^content-type'

# Every icon must be 200 image/png:
for p in /brand/android-chrome-192x192.png /brand/android-chrome-512x512.png \
         /brand/maskable-192.png /brand/maskable-512.png /icon.png /apple-icon.png; do
  curl -s -o /dev/null -w "%{http_code} %{content_type}  $p\n" "https://test.matchboard.football$p"
done
```

Chrome DevTools → Application → Manifest: no errors, "Installability: … is installable", icons
preview (including a maskable preview with the mark inside the safe circle).

## Per-environment acceptance matrix

For each row, record: date, app version, tester, and PASS/FAIL + notes per check.

| # | Environment |
|---|-------------|
| 1 | Windows + Edge (desktop) |
| 2 | Windows + Chrome (desktop) |
| 3 | Android + Chrome |
| 4 | Android + Edge |
| 5 | iPhone + Safari |

### Checks (all rows)

1. **Native install path is available** while not installed — address-bar install icon (desktop
   Chromium), or browser menu → "Install app" / "Add to Home screen" (Android), or Share → "Add
   to Home Screen" (iOS). Matchboard's in-app "Install Matchboard" card points at this path; it
   is a helper, not the installer.
2. **Install completes** without error.
3. **Correct icon** on the desktop/home screen: the Matchboard mark on an opaque Touchline accent
   (lime) background (ADR-0136 Phase 8). iOS and Android/desktop icons visually match. Test
   installs read "Matchboard Test".
4. **Launching from the installed icon** opens Matchboard in a standalone window/app (no browser
   tab strip / address bar).
5. **Standalone presentation** is correct — no content hidden behind the status bar or the iOS
   home indicator; bottom nav sits above the home indicator.
6. **Authentication works from the installed app** — unauthenticated launch lands on the
   Matchboard sign-in page (same origin), Google sign-in completes, and returns to Matchboard
   still in standalone mode.
7. **Navigation works** — primary nav (Today / League / Events / Players / More), and opening
   `/today` directly.
8. **No install prompt/help remains** after installation — the in-app card shows the installed
   confirmation (More page) or nothing (Today).
9. **Dynamic data is live** — open a recent planning change (e.g. a round/squad edit) and confirm
   it reflects current server state — there is no broad offline cache; nothing outside live
   reporting should ever look stale. (ADR-0138 Bundle 7 added one narrow, scoped exception: an
   already-established live-match reporting route can reopen after a reload while genuinely
   offline — see "Live-match offline continuation" below, a separate check from this one.)
10. **App shortcuts** (long-press the installed icon, where supported) — Today / League / Events.

## Live-match offline continuation (ADR-0138 Bundle 7)

A separate, narrower capability from general installability above — a scoped service worker
(`public/live-sw.js`) lets an already-established live-reporting session reopen after a reload
while genuinely offline. Automated coverage
(`e2e/live-reporting-offline-continuation.spec.ts`) exercises this in headless Chromium via
Playwright on every PR; this is a lighter spot-check for a real device, not a replacement.

1. On a real phone, open live reporting for a match and tap "Start live reporting" while online.
2. Wait a few seconds (the service worker registers and caches the offline shell in the
   background), then enable Airplane Mode.
3. Reload the page (or force-quit and reopen the installed app). The live-reporting screen must
   reappear with the session still active — never a browser offline error page, never the
   "Start live reporting" button reappearing.
4. Record a goal or rotation while offline — it must appear immediately (optimistic display) with
   a "Syncing…"/"…saved on this device" indicator, never lost.
5. Disable Airplane Mode. The recorded action(s) must sync automatically within a few seconds
   (no manual retry needed) and the sync indicator must clear.
6. Open a *different* match's live-reporting URL directly while still offline, for a match never
   opened on this device before — it must show an explicit "hasn't been opened yet on this
   device" message, never a blank page.
7. Confirm no other page (Today, Fixtures, Players, etc.) behaves any differently offline than
   before this feature — this capability is scoped to live-match routes only.

### Known limitations

- Desktop Chromium's address-bar install icon and Android's install prompt appear on the
  browser's own engagement schedule; "installable" in DevTools is the reliable signal that
  Matchboard has done its part.
- iOS provides no programmatic install and no `beforeinstallprompt`; the Share → Add to Home
  Screen path and the opaque `apple-icon.png` are all Matchboard can influence.
- These are documentation/acceptance checks, not `toHaveScreenshot()` visual-regression baselines.
