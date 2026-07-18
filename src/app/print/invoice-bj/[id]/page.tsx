import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function InvoiceBjPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { client: true, items: true } });
  if (!inv) notFound();

  const subtotal = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
  const ppn = inv.withPpn ? Math.round(subtotal * 0.11) : 0;
  const total = subtotal + ppn;

  return (
    <PrintDocument
      title={inv.invoiceNo}
      docTitle="Invoice Penagihan"
      meta={
        <>
          Ditagihkan kepada: <strong>{inv.client.name}</strong>
          <br />
          {inv.client.address || "-"}
          <br />
          No. Invoice: <strong>{inv.invoiceNo}</strong> &middot; Tanggal: {inv.date.toLocaleDateString("id-ID")} &middot; Jatuh tempo: {inv.dueDate.toLocaleDateString("id-ID")}
        </>
      }
      signLeftLabel="Diterima oleh"
      signLeftName={inv.client.name}
    >
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Harga satuan</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.id}>
              <td>{it.desc}</td>
              <td>{it.qty}</td>
              <td>{formatRp(it.price)}</td>
              <td>{formatRp(it.qty * it.price)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif", borderBottom: "none" }}>Subtotal</td>
            <td>{formatRp(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif", borderBottom: "none" }}>PPN 11%</td>
            <td>{formatRp(ppn)}</td>
          </tr>
          <tr className="total">
            <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif" }}>Total Tagihan</td>
            <td>{formatRp(total)}</td>
          </tr>
        </tbody>
      </table>
    </PrintDocument>
  );
}
