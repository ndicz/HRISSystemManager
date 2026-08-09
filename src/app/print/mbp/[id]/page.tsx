import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { terbilang, invoiceBjSubtotal, mbpPpnValue, mbpTotal } from "@/lib/finance";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function MbpPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mbp = await db.mbp.findUnique({ where: { id }, include: { client: true, items: true } });
  if (!mbp) notFound();

  const clientName = mbp.client?.name ?? mbp.clientNameManual ?? "-";
  const clientAddress = mbp.client?.address ?? "-";
  // Cost is deliberately never read here — this is the client-facing
  // document, only qty/price/total (the marked-up sell price) are shown.
  const subtotal = invoiceBjSubtotal(mbp.items);
  const ppn = mbpPpnValue(mbp.items, mbp.withPpn, mbp.ppnPercent);
  const total = mbpTotal(mbp.items, mbp.withPpn, mbp.ppnPercent);

  return (
    <PrintDocument
      title={mbp.mbpNo}
      docTitle="Material Budget Plan (Penawaran)"
      meta={
        <>
          Kepada: <strong>{clientName}</strong>
          <br />
          {clientAddress}
          <br />
          No. MBP: <strong>{mbp.mbpNo}</strong>
          {mbp.jobTitle && <><br />Nama Pekerjaan: <strong>{mbp.jobTitle}</strong></>}
          <br />
          Tanggal: {mbp.date.toLocaleDateString("id-ID")}
        </>
      }
      signLeftLabel="Disetujui oleh"
      signLeftName={clientName}
      signRightName={mbp.signerName || undefined}
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
          {mbp.items.map((it) => (
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
          {mbp.withPpn && (
            <tr>
              <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif", borderBottom: "none" }}>PPN {mbp.ppnPercent}%</td>
              <td>{formatRp(ppn)}</td>
            </tr>
          )}
          <tr className="total">
            <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif" }}>Total Penawaran</td>
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
