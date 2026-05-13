import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/adapter-neon"],
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

export default nextConfig;