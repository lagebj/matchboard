import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Barlow_Condensed } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";
import "./touchline.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Barlow Condensed — sports/numeric display roles ONLY (ADR-0134 §5): score,
// prominent live clock, large kickoff time, week/round marker, major evidence
// number. Never used for body/navigation/team/player names. Only the two
// weights the design needs are loaded.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Matchboard",
  description: "Squad selection and match-round planning for youth football.",
  applicationName: "Matchboard",
  // No explicit `manifest` entry — src/app/manifest.ts (Next.js's dynamic
  // MetadataRoute.Manifest convention) is auto-linked and branches per
  // request hostname (Test vs Production). Do not reintroduce a static
  // manifest reference here; it would compete with the dynamic route.
  //
  // appleWebApp emits apple-mobile-web-app-capable / -title / -status-bar-style
  // so iOS "Add to Home Screen" launches standalone with the right title. The
  // opaque brand icon iOS uses is src/app/apple-icon.png (ADR-0123).
  appleWebApp: {
    capable: true,
    title: "Matchboard",
    // "default": the iOS status bar keeps its own opaque strip and content
    // starts below it — no top safe-area work needed in the shell. (Avoid
    // "black-translucent", which drops content under the status bar.)
    statusBarStyle: "default",
  },
  other: {
    // Next emits the modern `mobile-web-app-capable`; iOS < 16.4 still needs
    // the prefixed form for a standalone Add-to-Home-Screen launch.
    "apple-mobile-web-app-capable": "yes",
  },
};

// themeColor / viewport-fit belong in the `viewport` export (the `metadata`
// equivalents are deprecated in Next). viewport-fit=cover opts standalone PWA
// layouts into the safe-area insets used by the app shell. themeColor is
// appearance-aware (ADR-0134): the dark canvas base for dark/system-dark, the
// light canvas base for light.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090b0f" },
    { media: "(prefers-color-scheme: light)", color: "#f3f5f1" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <head>
        {/* Pre-hydration appearance initializer — applies an explicit stored
            theme to <html> before first paint so there is no flash through the
            wrong appearance (ADR-0134 §3). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {children}
            <SpeedInsights />
            <Analytics />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
