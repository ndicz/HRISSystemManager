import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db, findUserByIdentifier } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { verifyLoginChallenge, verifyTotp } from "@/lib/totp";

// A session is a signed JWT, valid until it expires no matter what happens
// to the account behind it — deactivating a user (or changing their role)
// used to change nothing for a session that was already logged in. Every
// auth() on the server now re-reads the account (cached briefly so a page
// that calls auth() several times costs one query) and drops the session
// if it was deactivated or deleted. The proxy keeps using the edge-safe
// config; the (app) layout and every server action go through this one.
const ACCOUNT_CACHE_MS = 15_000;
const accountCache = new Map<string, { at: number; account: { active: boolean; role: string; pageAccess: string[] } | null }>();

async function currentAccount(userId: string) {
  const hit = accountCache.get(userId);
  if (hit && Date.now() - hit.at < ACCOUNT_CACHE_MS) return hit.account;
  const account = await db.user.findUnique({ where: { id: userId }, select: { active: true, role: true, pageAccess: true } });
  accountCache.set(userId, { at: Date.now(), account });
  return account;
}

export function forgetCachedAccount(userId: string) {
  accountCache.delete(userId);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt: async (params) => {
      const token = authConfig.callbacks!.jwt!(params) as Awaited<ReturnType<NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>>>;
      if (params.user || !token?.id) return token;
      const account = await currentAccount(token.id as string);
      if (!account || !account.active) return null;
      token.role = account.role;
      token.pageAccess = account.pageAccess;
      return token;
    },
  },
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

        let user: Awaited<ReturnType<typeof findUserByIdentifier>>;

        if (challenge) {
          // Step 2 of a 2FA login: the challenge stands in for the password.
          const userId = verifyLoginChallenge(challenge);
          if (!userId) return null;
          user = await db.user.findUnique({ where: { id: userId } });
          if (!user || !user.active || !user.totpEnabled || !user.totpSecret) return null;
          if (!code || !verifyTotp(user.totpSecret, code)) return null;
        } else {
          if (!email || !password) return null;
          user = await findUserByIdentifier(email.trim().toLowerCase());
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

        return { id: user.id, email: user.email, name: user.name, role: user.role, pageAccess: user.pageAccess };
      },
    }),
  ],
});
