import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="app-shell">
      <Sidebar userName={session.user.name ?? "Pengguna"} userRole={session.user.role} pageAccess={session.user.pageAccess} />
      <div className="app-content">{children}</div>
    </div>
  );
}
