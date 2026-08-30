import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { createMDX } from "fumadocs-mdx/next";
import { APP_VERSION } from "./src/lib/version/index";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withMDX = createMDX();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  reactCompiler: true,
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/adapter-neon"],
  outputFileTracingIncludes: {
    // custom-example (policies/examples/packs/) is non-deployable/illustrative and ships no
    // compiled Wasm — only the active built-in pack's artifact needs to be traced into the
    // deployment bundle. The legacy flat path is included for MATCHBOARD_POLICY_WASM_PATH
    // overrides that still point at it.
    "/**/*": [
      "./policies/compiled/matchboard_selection.wasm",
      "./policies/packs/matchboard-default/compiled/matchboard_selection.wasm",
    ],
  },
  async redirects() {
    return [
      // Today is now the canonical landing route (PROGRAMME.md §7); Assistant is the
      // deep-link alias, not the other way around (see docs/product/navigation-model.md).
      { source: "/assistant", destination: "/today", permanent: true },
      { source: "/o/:orgSlug/assistant", destination: "/o/:orgSlug/today", permanent: true },
      { source: "/matches", destination: "/fixtures", permanent: true },
      { source: "/matchday", destination: "/fixtures", permanent: true },
      { source: "/availability", destination: "/players", permanent: true },
      { source: "/weeks/:weekKey", destination: "/fixtures", permanent: true },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));