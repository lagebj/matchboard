import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
    error: "/error",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return isAllowedCoach(user.email);
    },
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

function isAllowedCoach(email: string): boolean {
  const allowed = process.env.ALLOWED_COACH_EMAILS;
  if (!allowed) return false;
  return allowed
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.trim().toLowerCase());
}