import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { canAccess } from "@/lib/rbac";

// Uses the edge-safe authConfig only (no Prisma) so this can run in
// the Edge runtime without pulling in Node.js-only native modules.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");

  if (!req.auth && !isPublic && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth?.user && !isPublic && !isAuthRoute) {
    const role = req.auth.user.role;
    if (!canAccess(role, req.nextUrl.pathname) && req.nextUrl.pathname !== "/akses-ditolak") {
      return NextResponse.redirect(new URL("/akses-ditolak", req.nextUrl.origin));
    }
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
