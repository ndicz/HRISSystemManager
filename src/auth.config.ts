import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the auth config: no Prisma/bcrypt imports here, so
// this can run in the Edge runtime (middleware). The Credentials
// provider itself (which needs the database) is added on top of this
// in src/auth.ts, which only runs in the Node.js runtime.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Trust the Host header from Vercel's proxy instead of requiring a
  // hardcoded NEXTAUTH_URL — the deployment URL isn't known until after
  // the first deploy, and Vercel's edge network sets this reliably.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id as string;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
