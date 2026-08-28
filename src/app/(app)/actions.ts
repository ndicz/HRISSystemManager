"use server";

import { signOut } from "@/auth";
import { BASE_PATH } from "@/lib/basePath";

export async function signOutAction() {
  // signOut's redirectTo is a plain string NextAuth turns straight into a
  // Location header — unlike next/navigation's redirect() or a cloned
  // NextURL, it never gets the app's basePath applied automatically, so it
  // has to be spelled out here or logout lands on a bare /login that 404s.
  await signOut({ redirectTo: `${BASE_PATH}/login` });
}
