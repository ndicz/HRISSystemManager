import { db } from "@/lib/db";
import { computeAgingRows } from "@/lib/finance";
import { KasTabs } from "@/components/KasTabs";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function KasPage() {
  const [accounts, cashAccounts, transactions, payables, closedPeriods, invoicesBj, invoices] = await Promise.all([
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.cashAccount.findMany(),
    db.transaction.findMany({ include: { account: true, cashAccount: true }, orderBy: { date: "desc" } }),
    db.payable.findMany({ orderBy: { dueDate: "asc" } }),
    db.closedPeriod.findMany({ select: { period: true } }),
    db.invoiceBj.findMany({ where: { status: { not: "lunas" } }, include: { client: true, items: true } }),
    db.invoice.findMany({ where: { status: { not: "lunas" } }, include: { client: true } }),
  ]);

  const agingRows = computeAgingRows(invoicesBj, invoices, new Date());

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/kas"]} title="Pengeluaran & Kas" subtitle="Arus kas, laba rugi, neraca, dan hutang usaha" />
      <KasTabs
        accounts={accounts}
        cashAccounts={cashAccounts}
        transactions={transactions}
        payables={payables}
        closedPeriods={closedPeriods.map((c) => c.period)}
        agingRows={agingRows}
      />
    </div>
  );
}
