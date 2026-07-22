"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { findUserByIdentifier } from "@/lib/db";
import { signLoginChallenge } from "@/lib/totp";

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
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

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
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

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
