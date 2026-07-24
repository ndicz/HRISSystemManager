"use client";

import { useState } from "react";
import type { InventoryRequest } from "@prisma/client";
import { formatRp } from "@/lib/payroll";

export function InventoryRequestDetailDialog({ request }: { request: InventoryRequest }) {
  const [open, setOpen] = useState(false);
  const total = request.qty * request.unitPrice;

  const rows: [string, string][] = [
    ["Barang", request.itemName],
    ["Jumlah", String(request.qty)],
    ["Harga satuan", formatRp(request.unitPrice)],
    ["Total nilai", formatRp(total)],
    ["Tanggal", request.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
    ["Nama peminta", request.requesterName],
    ["Tempat kerja/departemen", request.department || "-"],
    ["Keterangan", request.note || "-"],
    ["Status pencatatan Kas", request.transactionId ? "Sudah tercatat sebagai pengeluaran" : "Belum tercatat (akun/rekening Kas belum tersedia saat itu)"],
  ];

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Detail</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Detail Pengambilan Barang</div>
            <div className="dialog-body">
              <table className="table">
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label}>
                      <td className="text-muted" style={{ whiteSpace: "nowrap" }}>{label}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dialog-actions">
              <a href={`/print/inventory-request/${request.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Cetak bukti
              </a>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
