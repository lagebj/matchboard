import { test, expect, type Page } from "@playwright/test";

/**
 * Browser-level PWA installability regression coverage (ADR-0123).
 *
 * The prior PWA work only unit-tested the manifest TypeScript object. This
 * inspects Matchboard the way Chromium does: the manifest and its icons must
 * be reachable WITHOUT authentication (install-before-sign-in is normal, and
 * on production Next fetches `<link rel="manifest">` without credentials), the
 * manifest must parse with no critical errors, every icon must load, and the
 * effective display mode must support standalone installation.
 *
 * It deliberately does NOT assert that a browser paints an install icon in a
 * particular toolbar position — that is the browser's choice. What Matchboard
 * controls is installability and non-interference.
 */

// Installability diagnostics that must never appear. Service-worker / offline
// diagnostics are intentionally excluded — Matchboard has no service worker by
// design (ADR-0123), and one is not required for installability in modern
// Chromium.
const FORBIDDEN_INSTALLABILITY_ERRORS = new Set([
  "no-manifest",
  "manifest-empty",
  "start-url-not-valid",
  "manifest-missing-name-or-short-name",
  "manifest-display-not-supported",
  "manifest-missing-suitable-icon",
  "no-icon-available",
  "manifest-location-changed",
  "not-from-secure-origin",
  "no-acceptable-icon",
]);

function pngSize(buf: Buffer): { width: number; height: number } {
  // PNG signature (8 bytes) + IHDR length (4) + "IHDR" (4) -> width@16, height@20.
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.describe("PWA manifest & icons are publicly installable", () => {
  // No session — this is the state a user is in when they first install.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("GET /manifest.webmanifest returns the manifest JSON, not an auth redirect", async ({
    request,
  }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status(), "manifest must not redirect to /signin").toBe(200);
    expect(res.headers()["content-type"] ?? "").toContain("application/manifest+json");

    const body = await res.text();
    expect(body, "manifest body must be JSON, not the sign-in HTML page").not.toContain(
      "<!DOCTYPE",
    );
    const manifest = JSON.parse(body) as Record<string, unknown>;

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/today");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");

    const icons = (manifest.icons ?? []) as Array<{ sizes?: string; purpose?: string }>;
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512")).toBe(true);
    expect(icons.some((i) => (i.purpose ?? "").includes("maskable"))).toBe(true);
  });

  test("every manifest icon + the HTML head icons load as PNGs with the declared size", async ({
    request,
  }) => {
    const manifest = JSON.parse(await (await request.get("/manifest.webmanifest")).text()) as {
      icons: Array<{ src: string; sizes: string }>;
    };

    const targets = [
      ...manifest.icons.map((i) => ({ src: i.src, sizes: i.sizes })),
      { src: "/icon.png", sizes: "32x32" },
      { src: "/apple-icon.png", sizes: "180x180" },
    ];

    for (const { src, sizes } of targets) {
      const res = await request.get(src);
      expect(res.status(), `${src} must be publicly fetchable`).toBe(200);
      expect(res.headers()["content-type"] ?? "", `${src} content-type`).toContain("image/png");

      const { width, height } = pngSize(await res.body());
      const [w, h] = sizes.split("x").map(Number);
      expect({ src, width, height }).toEqual({ src, width: w, height: h });
    }
  });

  test("the sign-in page links the manifest so an unauthenticated browser can discover it", async ({
    page,
  }) => {
    await page.goto("/signin");
    const href = await page.locator('link[rel="manifest"]').first().getAttribute("href");
    expect(href).toBeTruthy();
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toContain("application/manifest+json");
  });

  test("Chromium parses the manifest with no critical errors and no blocking installability errors", async ({
    page,
  }) => {
    const client = await page.context().newCDPSession(page);
    await client.send("Page.enable");
    await page.goto("/signin");

    const appManifest = await client.send("Page.getAppManifest");
    expect(appManifest.url).toMatch(/\/manifest\.webmanifest$/);

    const critical = (appManifest.errors ?? []).filter((e) => e.critical);
    expect(critical, `critical manifest errors: ${JSON.stringify(appManifest.errors)}`).toEqual([]);

    expect(appManifest.data, "Chromium received manifest content").toBeTruthy();
    const parsed = JSON.parse(appManifest.data as string) as Record<string, unknown>;
    expect(parsed.display).toBe("standalone");
    expect(parsed.name).toBeTruthy();
    expect(parsed.start_url).toBe("/today");

    // Deprecated but still present in this Chromium — best-effort, informative.
    try {
      const { installabilityErrors } = (await client.send(
        "Page.getInstallabilityErrors",
      )) as { installabilityErrors: Array<{ errorId: string }> };
      const ids = installabilityErrors.map((e) => e.errorId);
      console.log("Page.getInstallabilityErrors:", ids.length ? ids.join(", ") : "(none)");
      const blocking = ids.filter((id) => FORBIDDEN_INSTALLABILITY_ERRORS.has(id));
      expect(blocking, `blocking installability errors: ${blocking.join(", ")}`).toEqual([]);
    } catch {
      // getInstallabilityErrors removed in a future Chromium — the getAppManifest
      // assertions above are the durable contract.
    }
  });
});

test.describe("standalone launch & start_url", () => {
  test("unauthenticated start_url resolves same-origin (to the sign-in page)", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const res = await ctx.request.get("/today");
    expect(res.status(), "start_url must not error").toBe(200);
    // No cross-origin bounce out of manifest scope — it lands on our own /signin.
    expect(new URL(res.url()).origin).toBe(new URL(baseURL!).origin);
    expect(res.url()).toMatch(/\/signin/);
    await ctx.close();
  });

  test("authenticated start_url resolves to Today within manifest scope", async ({ page }) => {
    // Uses the project's authenticated storageState (chromium project).
    const res = await page.goto("/today");
    expect(res?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toMatch(/^\/(o\/[^/]+\/)?today$/);
  });

  test("the install card renders actionable guidance on a phone viewport (browser owns install)", async ({
    browser,
  }) => {
    // Pixel 7-ish viewport + touch; keep the project's auth so /today renders the card.
    const ctx = await browser.newContext({
      storageState: "e2e/.auth/coach.json",
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    });
    const page = await ctx.newPage();
    await gotoToday(page);

    const card = page.getByText("Install Matchboard", { exact: true });
    await expect(card).toBeVisible();
    // We never fake standalone here — the emulated browser is a normal tab.
    expect(await page.evaluate(() => matchMedia("(display-mode: browser)").matches)).toBe(true);
    await ctx.close();
  });
});

async function gotoToday(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/today/);
}
