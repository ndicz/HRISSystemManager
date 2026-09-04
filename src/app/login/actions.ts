"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { findUserByIdentifier } from "@/lib/db";
import { signLoginChallenge } from "@/lib/totp";
import { BASE_PATH } from "@/lib/basePath";

export type LoginState =
  | { step: "credentials"; error?: string }
  | { step: "code"; challenge: string; error?: string };

// Step 1: email + password. Accounts without 2FA sign in immediately
// here (same single-step flow as before); accounts with 2FA get a
// signed challenge back instead, standing in for the password on step 2
// so it's never sent to the server a second time.
export async function checkCredentials(
  _prevState: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // callbackUrl travels through this app basePath-stripped (proxy.ts reads
  // it off req.nextUrl.pathname, LoginForm defaults to "/") — signIn's
  // redirectTo never gets the basePath re-applied automatically the way
  // next/link or a cloned NextURL would, so it has to be added here or the
  // post-login redirect 404s (same issue as signOutAction).
  const callbackUrl = BASE_PATH + ((formData.get("callbackUrl") as string) || "/");

  const user = await findUserByIdentifier(identifier);
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { step: "credentials", error: "ID login, email, atau password salah." };
  }

  if (!user.totpEnabled) {
    try {
      await signIn("credentials", { email: identifier, password, redirectTo: callbackUrl });
    } catch (err) {
      if (err instanceof AuthError) return { step: "credentials", error: "ID login, email, atau password salah." };
      throw err;
    }
    return { step: "credentials" };
  }

  return { step: "code", challenge: signLoginChallenge(user.id) };
}

// Step 2 (2FA accounts only): the challenge from step 1 + a 6-digit code.
export async function completeLogin(
  prevState: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const challenge = String(formData.get("challenge") ?? "");
  const code = String(formData.get("code") ?? "");
  const callbackUrl = BASE_PATH + ((formData.get("callbackUrl") as string) || "/");

  try {
    await signIn("credentials", { challenge, code, redirectTo: callbackUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      return { step: "code", challenge, error: "Kode salah atau sudah kedaluwarsa." };
    }
    throw err;
  }
  return { step: "code", challenge };
  
}
