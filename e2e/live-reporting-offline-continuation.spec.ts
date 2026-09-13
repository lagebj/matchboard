import { test, expect } from "@playwright/test";
import { createFinalizedLiveTestMatch, waitForEventsToSync } from "./helpers/live-match-fixtures";

/**
 * ADR-0138 Bundle 7 ("Scoped PWA offline continuation") — this is the exit-criteria evidence:
 * "Offline continuation contract... is real, not merely local queue code behind a page that
 * cannot reopen." A real service worker + IndexedDB prepared package must let an already-
 * established live-reporting session survive a full reload while genuinely offline, not just
 * survive while the page stays loaded (that narrower guarantee is Bundle 6's, already covered
 * by live-reporting.spec.ts).
 */

test("an established live-reporting session reopens after a reload while genuinely offline", async ({ page, context }) => {
  test.setTimeout(120_000);
  const { matchId } = await createFinalizedLiveTestMatch(page, "OfflineContinuation");

  await page.getByRole("link", { name: "Live reporting" }).click();
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Start live reporting" }).click();
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

  // The service worker registers on mount (registerLiveServiceWorker) and caches the offline
  // shell + static assets during its own install step — wait for it to actually be ready and
  // controlling this page before going offline, or the very first offline reload would fall
  // through to the browser's own default offline error instead of the cached shell.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20_000 });

  // Give the prepared-package save (fire-and-forget after getPreMatchPackage resolves) and the
  // shell/static asset caching a moment to actually land in IndexedDB/CacheStorage.
  await page.waitForTimeout(1_000);
  const hasPreparedPackage = await page.evaluate(
    (id) =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open("matchboard-live");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("preparedPackage")) return resolve(false);
          const tx = db.transaction("preparedPackage", "readonly");
          const getReq = tx.objectStore("preparedPackage").get(id);
          getReq.onsuccess = () => resolve(getReq.result != null);
          getReq.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      }),
    matchId,
  );
  expect(hasPreparedPackage, "prepared package must be saved before going offline").toBe(true);

  await context.setOffline(true);
  await page.reload();

  // The service worker's navigation fallback serves the cached offline shell for this exact
  // URL — the address bar stays on the real match URL throughout (never a redirect to
  // /offline-live). The shell reads the prepared package from IndexedDB and reconstructs the
  // same live-reporting screen, including the already-active session (no "Start live reporting"
  // button reappearing).
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Start live reporting" })).not.toBeVisible();

  // Record an operation while offline — persisted locally (Bundle 6's outbox), never lost.
  await page.getByRole("button", { name: "Goal for us" }).click();
  await expect(page.getByText(/changes saved on this device|Syncing \d+ change/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Skip" }).click();

  // Back online: the same offline-recorded goal converges to the real score.
  await context.setOffline(false);
  await waitForEventsToSync(page);
  await expect(page.getByTestId("live-score-us")).toHaveText("1", { timeout: 15_000 });
});

test("a second match never opened on this device while online shows an explicit message, not a blank page, when offline (work item 8)", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  // Establish the service worker on this device/context first, via a match that IS opened
  // online — this is the realistic scenario work item 8 describes: the SW and its static-asset
  // cache already exist on this device from live-reporting a different match; this specific
  // second match's live route was simply never visited while online.
  await createFinalizedLiveTestMatch(page, "PreparedOffline");
  await page.getByRole("link", { name: "Live reporting" }).click();
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 20_000 });

  const neverOpened = await createFinalizedLiveTestMatch(page, "NeverPreparedOffline");

  await context.setOffline(true);
  await page.goto(`/o/test-club-a/matches/${neverOpened.matchId}/live`);

  // The offline shell correctly distinguishes "no prepared package for this id" from a crash or
  // blank screen — the coach is told plainly why nothing loaded and what to do about it.
  await expect(page.getByText(/hasn.t been opened yet on this device/i)).toBeVisible({ timeout: 15_000 });
});
