import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/adapter-neon"],
  async redirects() {
    return [
      { source: "/matches", destination: "/rounds", permanent: true },
      { source: "/assistant", destination: "/", permanent: true },
      { source: "/matchday", destination: "/rounds", permanent: true },
      { source: "/planner", destination: "/history", permanent: true },
      { source: "/rotation", destination: "/history", permanent: true },
      { source: "/tactics", destination: "/rounds", permanent: true },
      { source: "/availability", destination: "/players", permanent: true },
      { source: "/weeks/:weekKey", destination: "/rounds", permanent: true },
    ];
  },
};

export default nextConfig;