import { db } from "@/lib/db";
import { KasTabs } from "@/components/KasTabs";

export default async function KasPage() {
  const [accounts, cashAccounts, transactions, payables, closedPeriods] = await Promise.all([
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.cashAccount.findMany(),
    db.transaction.findMany({ include: { account: true, cashAccount: true }, orderBy: { date: "desc" } }),
    db.payable.findMany({ orderBy: { dueDate: "asc" } }),
    db.closedPeriod.findMany({ select: { period: true } }),
  ]);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Pengeluaran &amp; Kas</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Arus kas, laba rugi, neraca, dan hutang usaha</p>
      </div>
      <KasTabs
        accounts={accounts}
        cashAccounts={cashAccounts}
        transactions={transactions}
        payables={payables}
        closedPeriods={closedPeriods.map((c) => c.period)}
      />
    </div>
  );
}
