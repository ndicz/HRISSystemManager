import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Sidebar badge for "MBP" — how many requests need attention. For office
  // roles that's every pending request; for a field EMPLOYEE it's their own
  // (so they can tell a decision came back without opening the page). This
  // recomputes on every navigation/reload — good enough for a badge count,
  // no separate polling/push mechanism.
  let mbpPending = 0;
  if (["ADMIN", "FINANCE"].includes(session.user.role)) {
    mbpPending = await db.mbpRequest.count({ where: { status: "menunggu" } });
  } else if (session.user.role === "EMPLOYEE") {
    mbpPending = await db.mbpRequest.count({ where: { status: "menunggu", createdById: session.user.id } });
  }

  return (
    <div className="app-shell">
      <Sidebar
        userName={session.user.name ?? "Pengguna"}
        userRole={session.user.role}
        pageAccess={session.user.pageAccess}
        badgeCounts={mbpPending > 0 ? { "/mbp": mbpPending } : undefined}
      />
      <div className="app-content">{children}</div>
    </div>
  );
}
