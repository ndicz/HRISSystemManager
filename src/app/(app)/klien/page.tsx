import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { computeAgingRows, AGING_BUCKET_ORDER } from "@/lib/finance";
import { KlienTables } from "@/components/KlienTables";
import { DocHandoverDateInput } from "@/components/DocHandoverDateInput";

export default async function KlienPage() {
  const [clients, invoicesBj, invoices, sites] = await Promise.all([
    db.client.findMany({ include: { employees: true }, orderBy: { createdAt: "desc" } }),
    db.invoiceBj.findMany({ include: { client: true, items: true }, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ include: { client: true }, orderBy: { period: "desc" } }),
    db.site.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const siteNames = sites.map((s) => s.name);

  const now = new Date();
  const agingRows = computeAgingRows(invoicesBj, invoices, now);
  const agingTotals = AGING_BUCKET_ORDER.map((b) => ({
    bucket: b,
    total: agingRows.filter((r) => r.bucket === b).reduce((s, r) => s + r.amount, 0),
  }));
  const totalPiutang = agingRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Klien &amp; Tagihan</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Data klien, skema fee jasa, dan invoice barang &amp; jasa</p>
      </div>

      <KlienTables clients={clients} invoicesBj={invoicesBj} invoices={invoices} siteNames={siteNames} />

      <div className="card" style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <div className="card-kicker">Aging Piutang</div>
          <span className="tag tag-outline">Total: {formatRp(totalPiutang)}</span>
        </div>
        <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
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
                <th>Tgl. penyerahan dokumen</th>
                <th>Jumlah</th>
                <th>Umur</th>
              </tr>
            </thead>
            <tbody>
              {agingRows.map((r) => (
                <tr key={r.type + r.id}>
                  <td>{r.name}</td>
                  <td className="text-muted">{r.source}</td>
                  <td className="text-muted">{r.dueDate.toLocaleDateString("id-ID")}</td>
                  <td><DocHandoverDateInput type={r.type} id={r.id} value={r.docHandoverDate} /></td>
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
