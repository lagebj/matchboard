import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
// layouts into the safe-area insets used by the app shell.
export const viewport: Viewport = {
  themeColor: "#0a0d13",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <NextIntlClientProvider messages={messages}>
          {children}
          <SpeedInsights />
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}