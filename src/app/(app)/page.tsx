import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { DashboardTabs } from "@/components/DashboardTabs";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function DashboardPage() {
  const session = await auth();
  // Proxy already redirects single-module roles away from "/" — this is the
  // same rule enforced again at the page itself, in case that path is ever
  // reached some other way (e.g. client-side navigation instead of a fresh
  // request).
  if (session?.user?.role === "EMPLOYEE") redirect("/mbp");
  if (session?.user?.role === "MARKETING") redirect("/crm");

  const [employees, sites, cashAccounts, transactions] = await Promise.all([
    db.employee.findMany({
      where: { status: "aktif" },
      include: { site: true, position: true, salaryComponents: true },
    }),
    db.site.findMany(),
    db.cashAccount.findMany(),
    db.transaction.findMany({
      orderBy: { date: "desc" },
      include: { account: true },
    }),
  ]);

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/"]} title="Dashboard" subtitle="Ringkasan keuangan dan kehadiran" />

      <DashboardTabs employees={employees} sites={sites} cashAccounts={cashAccounts} transactions={transactions} />
    </div>
  );
}
