import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccess, type Role } from "@/lib/rbac";
import { UserError } from "@/lib/userError";

// Server Actions are reachable by a direct POST from any logged-in session,
// whatever the proxy and the sidebar show — so each one checks, on its own,
// that the caller may use the page(s) it belongs to. Same access map as the
// menu (lib/rbac.ts canAccess), including per-user custom page access.
export async function requireAccess(pages: string | string[], opts?: { denyRoles?: Role[] }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const { role, pageAccess } = session.user;
  const list = Array.isArray(pages) ? pages : [pages];
  if (opts?.denyRoles?.includes(role as Role) || !list.some((p) => canAccess(role, p, pageAccess))) {
    throw new UserError("Akun Anda tidak punya akses untuk aksi ini.");
  }
  return session;
}

// Same rule for a server-rendered page (print pages, which the proxy also
// guards — this is the second line in case a request slips past it).
export async function requirePageAccess(pathname: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccess(session.user.role, pathname, session.user.pageAccess)) redirect("/akses-ditolak");
  return session;
}
