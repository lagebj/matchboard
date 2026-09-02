import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { isTestAgentAuthEnabled, getTestAgentAuthSecret } from "@/lib/env";

/**
 * Lightweight auth instance for the proxy layer (src/proxy.ts).
 *
 * This is separate from src/auth.ts (which includes the database adapter
 * and the test-agent db.user.upsert authorize) because the proxy runs on
 * every matching request and its module-import chain must stay lean — no
 * PrismaClient initialization, no database module graph. The proxy only
 * needs JWT session verification (req.auth?.user?.email), never
 * adapter-backed database lookups.
 *
 * Route handlers and server actions continue to use `auth` from @/auth, which
 * includes the full database adapter for sign-in flows and test-agent user
 * upsert.
 *
 * Both instances share the same Google provider and JWT session configuration,
 * so session tokens created by either are mutually verifiable.
 */

const proxyProviders: Provider[] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID!,
    clientSecret: process.env.AUTH_GOOGLE_SECRET!,
  }),
];

if (isTestAgentAuthEnabled()) {
  proxyProviders.push(
    Credentials({
      id: "test-agent",
      name: "Test Agent",
      credentials: {
        email: { label: "Email", type: "email" },
        secret: { label: "Secret", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.secret) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const secret = String(credentials.secret);

        const expectedSecret = getTestAgentAuthSecret();
        if (!expectedSecret || secret !== expectedSecret) return null;

        const namespace =
          process.env.TEST_AGENT_AUTH_NAMESPACE ?? "test-agent.matchboard.football";
        if (!email.endsWith(`@${namespace}`)) return null;

        // Lightweight: no database upsert. The proxy only verifies the session,
        // it never creates users. Sign-in goes through @/auth's handlers route
        // which has the full database adapter — the proxy's authorize is only
        // reached if someone POSTs to /api/auth/callback/test-agent through
        // the proxy, which then redirects to the actual Auth.js handler.
        return {
          id: `test-agent-${email}`,
          email,
          name: email.split("@")[0],
        };
      },
    }),
  );
}

export const { auth: proxyAuth } = NextAuth({
  providers: proxyProviders,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 4 * 60 * 60,
  },
  trustHost: true,
  pages: {
    signIn: "/signin",
    error: "/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});