import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { KlienTables } from "@/components/KlienTables";

function invoiceTotal(items: { qty: number; price: number }[], withPpn: boolean) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  return withPpn ? Math.round(subtotal * 1.11) : subtotal;
}

function agingBucket(dueDate: Date, ref: Date): string {
  const days = Math.floor((ref.getTime() - dueDate.getTime()) / 86400000);
  if (days <= 0) return "Belum jatuh tempo";
  if (days <= 30) return "1-30 hari";
  if (days <= 60) return "31-60 hari";
  if (days <= 90) return "61-90 hari";
  return ">90 hari";
}

export default async function KlienPage() {
  const [clients, invoicesBj, invoices] = await Promise.all([
    db.client.findMany({ include: { employees: true }, orderBy: { createdAt: "desc" } }),
    db.invoiceBj.findMany({ include: { client: true, items: true }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ include: { client: true }, orderBy: { period: "desc" } }),
  ]);

  const now = new Date();
  const bucketOrder = ["Belum jatuh tempo", "1-30 hari", "31-60 hari", "61-90 hari", ">90 hari"];
  const agingRows: { name: string; source: string; dueDate: Date; amount: number; bucket: string }[] = [];

  for (const inv of invoicesBj) {
    if (inv.status === "lunas") continue;
    agingRows.push({
      name: inv.client.name + " — " + inv.invoiceNo,
      source: "Barang & Jasa",
      dueDate: inv.dueDate,
      amount: invoiceTotal(inv.items, inv.withPpn),
      bucket: agingBucket(inv.dueDate, now),
    });
  }
  for (const inv of invoices) {
    if (inv.status === "lunas" || !inv.dueDate) continue;
    agingRows.push({
      name: inv.client.name + " — " + inv.invoiceNo,
      source: "Outsourcing",
      dueDate: inv.dueDate,
      amount: inv.total,
      bucket: agingBucket(inv.dueDate, now),
    });
  }
  agingRows.sort((a, b) => bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket));
  const agingTotals = bucketOrder.map((b) => ({
    bucket: b,
    total: agingRows.filter((r) => r.bucket === b).reduce((s, r) => s + r.amount, 0),
  }));
  const totalPiutang = agingRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Klien &amp; Tagihan</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Data klien, skema fee jasa, dan invoice barang &amp; jasa</p>
      </div>

      <KlienTables clients={clients} invoicesBj={invoicesBj} invoices={invoices} />

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Aging Piutang</div>
          <span className="tag tag-outline">Total: {formatRp(totalPiutang)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          {agingTotals.map((b) => (
            <div key={b.bucket} className="card" style={{ padding: "var(--space-3)" }}>
              <div className="card-kicker" style={{ fontSize: 11 }}>{b.bucket}</div>
              <div style={{ fontWeight: 600 }}>{formatRp(b.total)}</div>
            </div>
          ))}
        </div>
        {agingRows.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Tidak ada piutang tertunggak.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Sumber</th>
                <th>Jatuh tempo</th>
                <th>Jumlah</th>
                <th>Umur</th>
              </tr>
            </thead>
            <tbody>
              {agingRows.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td className="text-muted">{r.source}</td>
                  <td className="text-muted">{r.dueDate.toLocaleDateString("id-ID")}</td>
                  <td style={{ fontWeight: 600 }}>{formatRp(r.amount)}</td>
                  <td><span className={r.bucket === "Belum jatuh tempo" ? "tag tag-accent" : "tag tag-neutral"}>{r.bucket}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
