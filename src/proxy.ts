import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { canAccess } from "@/lib/rbac";

// Uses the edge-safe authConfig only (no Prisma) — kept even though Proxy
// now defaults to the Node.js runtime, since this file still needs no
// database access and staying edge-safe costs nothing.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

// Single-module roles with no Dashboard — sent straight to their actual
// page instead of an access-denied screen when they hit "/" (this also
// covers the post-login default redirect, which lands on "/" when no
// callbackUrl is set).
const HOME_REDIRECT: Record<string, string> = {
  EMPLOYEE: "/mbp",
  MARKETING: "/crm",
};

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");

  // req.nextUrl.clone() (not `new URL(path, req.nextUrl.origin)`) — a clone
  // keeps NextURL's basePath tracking, so it gets re-added automatically
  // when the redirect is serialized. Building a plain URL from origin+path
  // drops the basePath entirely and would redirect outside the app.
  if (!req.auth && !isPublic && !isAuthRoute) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth?.user && !isPublic && !isAuthRoute) {
    const role = req.auth.user.role;
    const home = HOME_REDIRECT[role];
    if (home && req.nextUrl.pathname === "/") {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = home;
      return NextResponse.redirect(homeUrl);
    }
    if (!canAccess(role, req.nextUrl.pathname, req.auth.user.pageAccess) && req.nextUrl.pathname !== "/akses-ditolak") {
      const deniedUrl = req.nextUrl.clone();
      deniedUrl.pathname = "/akses-ditolak";
      return NextResponse.redirect(deniedUrl);
    }
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
