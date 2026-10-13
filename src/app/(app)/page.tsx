import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { DashboardTabs } from "@/components/DashboardTabs";
import { canAccess } from "@/lib/rbac";
import { formatRp, payrollPeriodKey, payrollPeriodLabel } from "@/lib/payroll";
import { invoiceBjTotal } from "@/lib/finance";

export default async function DashboardPage() {
  const session = await auth();
  // Proxy already redirects single-module roles away from "/" — this is the
  // same rule enforced again at the page itself, in case that path is ever
  // reached some other way (e.g. client-side navigation instead of a fresh
  // request).
  if (session?.user?.role === "EMPLOYEE") redirect("/mbp");
  if (session?.user?.role === "MARKETING") redirect("/crm");

  const role = session?.user?.role ?? "";
  const pageAccess = session?.user?.pageAccess;
  const now = new Date();
  const payPeriod = payrollPeriodKey(now);
  const [employees, sites, cashAccounts, transactions, pendingLeave, pendingMbp, paidThisPeriod, overdueBj, overdueOs] = await Promise.all([
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
    db.leaveRequest.count({ where: { status: "menunggu" } }),
    db.mbpRequest.count({ where: { status: "menunggu" } }),
    db.payrollEntry.count({ where: { period: payPeriod, paid: true, employee: { status: "aktif" } } }),
    db.invoiceBj.findMany({ where: { status: "terkirim", dueDate: { lt: now } }, include: { items: true } }),
    db.invoice.findMany({ where: { status: "terkirim", dueDate: { lt: now } }, select: { total: true } }),
  ]);

  // "Perlu perhatian": things waiting on someone, limited to what this
  // role can actually open and act on.
  const overdueTotal = overdueBj.reduce((s, i) => s + invoiceBjTotal(i.items, i.discountPercent, i.withPpn, i.ppnPercent), 0) + overdueOs.reduce((s, i) => s + i.total, 0);
  const attention = [
    { href: "/cuti", show: pendingLeave > 0, text: `${pendingLeave} pengajuan cuti menunggu persetujuan` },
    { href: "/mbp", show: pendingMbp > 0, text: `${pendingMbp} permintaan barang menunggu diproses` },
    { href: "/penggajian", show: paidThisPeriod < employees.length, text: `Gaji ${payrollPeriodLabel(payPeriod)}: ${paidThisPeriod} dari ${employees.length} karyawan sudah dibayar` },
    { href: "/klien", show: overdueBj.length + overdueOs.length > 0, text: `${overdueBj.length + overdueOs.length} invoice lewat jatuh tempo (${formatRp(overdueTotal)})` },
  ].filter((a) => a.show && canAccess(role, a.href, pageAccess)).map(({ href, text }) => ({ href, text }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div className="page-header">
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Ringkasan keuangan dan kehadiran</p>
        </div>
      </div>

      <DashboardTabs employees={employees} sites={sites} cashAccounts={cashAccounts} transactions={transactions} attention={attention} />
    </div>
  );
}
