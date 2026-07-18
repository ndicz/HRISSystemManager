import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      <Sidebar userName={session.user.name ?? "Pengguna"} userRole={session.user.role} />
      <div style={{ flex: 1, minWidth: 0, padding: "var(--space-6) var(--space-8) var(--space-8)" }}>
        {children}
      </div>
    </div>
  );
}
