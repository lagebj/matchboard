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
      { source: "/today", destination: "/assistant", permanent: true },
      { source: "/matches", destination: "/fixtures", permanent: true },
      { source: "/matchday", destination: "/fixtures", permanent: true },
      { source: "/availability", destination: "/players", permanent: true },
      { source: "/weeks/:weekKey", destination: "/fixtures", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);