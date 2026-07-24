import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { terbilang, invoiceBjSubtotal, invoiceBjDiscountValue } from "@/lib/finance";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function InvoiceBjPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoiceBj.findUnique({ where: { id }, include: { client: true, items: true } });
  if (!inv) notFound();

  const subtotal = invoiceBjSubtotal(inv.items);
  const discountValue = invoiceBjDiscountValue(inv.items, inv.discountPercent);
  const afterDiscount = subtotal - discountValue;
  const ppn = inv.withPpn ? Math.round(afterDiscount * 0.11) : 0;
  const total = afterDiscount + ppn;

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
          No. Invoice: <strong>{inv.invoiceNo}</strong>
          {inv.jobTitle && <><br />Nama Pekerjaan: <strong>{inv.jobTitle}</strong></>}
          <br />
          Tanggal: {inv.date.toLocaleDateString("id-ID")} &middot; Jatuh tempo: {inv.dueDate.toLocaleDateString("id-ID")}
        </>
      }
      signLeftLabel="Diterima oleh"
      signLeftName={inv.client.name}
      signRightName={inv.signerName || undefined}
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
          {inv.discountPercent > 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif", borderBottom: "none" }}>
                Diskon {inv.discountPercent}%{inv.discountDesc ? ` (${inv.discountDesc})` : ""}
              </td>
              <td>-{formatRp(discountValue)}</td>
            </tr>
          )}
          {inv.withPpn && (
            <tr>
              <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif", borderBottom: "none" }}>PPN 11%</td>
              <td>{formatRp(ppn)}</td>
            </tr>
          )}
          <tr className="total">
            <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif" }}>Total Tagihan</td>
            <td>{formatRp(total)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 11.5, fontStyle: "italic", marginTop: 10 }}>
        Terbilang: {terbilang(total)}
      </p>
    </PrintDocument>
  );
}
