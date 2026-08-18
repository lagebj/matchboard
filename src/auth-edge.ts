import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { isTestAgentAuthEnabled, getTestAgentAuthSecret } from "@/lib/env";

const providers: Provider[] = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID!,
    clientSecret: process.env.AUTH_GOOGLE_SECRET!,
  }),
];

if (isTestAgentAuthEnabled()) {
  providers.push(
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

        const namespace = process.env.TEST_AGENT_AUTH_NAMESPACE ?? "test-agent.matchboard.football";
        if (!email.endsWith(`@${namespace}`)) return null;

        return {
          id: `test-agent-${email}`,
          email,
          name: email.split("@")[0],
        };
      },
    }),
  );
}

export const { auth: edgeAuth } = NextAuth({
  providers,
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