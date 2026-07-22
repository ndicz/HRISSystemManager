import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { verifyLoginChallenge, verifyTotp } from "@/lib/totp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Set instead of password on the second step of a 2FA login —
        // proves the password was already checked a few minutes ago
        // without ever sending it again.
        challenge: { label: "Challenge", type: "text" },
        code: { label: "Code", type: "text" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const challenge = credentials?.challenge as string | undefined;
        const code = credentials?.code as string | undefined;

        let user: Awaited<ReturnType<typeof db.user.findUnique>>;

        if (challenge) {
          // Step 2 of a 2FA login: the challenge stands in for the password.
          const userId = verifyLoginChallenge(challenge);
          if (!userId) return null;
          user = await db.user.findUnique({ where: { id: userId } });
          if (!user || !user.active || !user.totpEnabled || !user.totpSecret) return null;
          if (!code || !verifyTotp(user.totpSecret, code)) return null;
        } else {
          if (!email || !password) return null;
          user = await db.user.findUnique({ where: { email } });
          if (!user || !user.active) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          // Password alone isn't enough for a 2FA-enabled account — the
          // login form is expected to catch this earlier (via
          // checkCredentials) and go through the challenge+code path
          // instead, but this is the actual enforcement point.
          if (user.totpEnabled) return null;
        }

        await db.auditLog.create({
          data: { userId: user.id, action: "auth.login", entity: "User", entityId: user.id },
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
