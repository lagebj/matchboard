import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { APP_VERSION } from "./src/lib/version/index";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  reactCompiler: true,
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/adapter-neon"],
  outputFileTracingIncludes: {
    "/**/*": [
      "./policies/compiled/matchboard_selection.wasm",
      "./policies/packs/matchboard-default/compiled/matchboard_selection.wasm",
      "./policies/packs/custom-example/compiled/custom_selection.wasm",
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

export default withNextIntl(nextConfig);