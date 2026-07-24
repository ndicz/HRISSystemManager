import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRp } from "@/lib/payroll";
import { terbilang } from "@/lib/finance";
import { PrintDocument } from "@/components/print/PrintDocument";

export default async function InventoryRequestPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await db.inventoryRequest.findUnique({ where: { id } });
  if (!req) notFound();

  const total = req.qty * req.unitPrice;

  return (
    <PrintDocument
      title={`Bukti Pengeluaran Barang — ${req.itemName}`}
      docTitle="Bukti Pengeluaran Barang Gudang"
      meta={
        <>
          Diserahkan kepada: <strong>{req.requesterName}</strong>
          {req.department && <> &middot; {req.department}</>}
          <br />
          Tanggal: {req.date.toLocaleDateString("id-ID")}
          {req.note && <><br />Keterangan: {req.note}</>}
        </>
      }
      signLeftLabel="Diterima oleh"
      signLeftName={req.requesterName}
    >
      <table>
        <thead>
          <tr>
            <th>Barang</th>
            <th>Jumlah</th>
            <th>Harga satuan</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{req.itemName}</td>
            <td>{req.qty}</td>
            <td>{formatRp(req.unitPrice)}</td>
            <td>{formatRp(total)}</td>
          </tr>
          <tr className="total">
            <td colSpan={3} style={{ textAlign: "right", fontFamily: "system-ui, sans-serif" }}>Total Nilai Barang</td>
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
