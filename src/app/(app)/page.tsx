import { db } from "@/lib/db";
import { DashboardTabs } from "@/components/DashboardTabs";

export default async function DashboardPage() {
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Ringkasan keuangan dan kehadiran</p>
        </div>
      </div>

      <DashboardTabs employees={employees} sites={sites} cashAccounts={cashAccounts} transactions={transactions} />
    </div>
  );
}
