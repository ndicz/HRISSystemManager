"use client";

import { useState } from "react";
import type { InventoryRequest } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { cancelInventoryRequest } from "@/app/(app)/gudang/actions";

export function InventoryRequestDetailDialog({ request }: { request: InventoryRequest }) {
  const [open, setOpen] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelPending, setCancelPending] = useState(false);
  const total = request.qty * request.unitPrice;

  function handleCancel() {
    if (!window.confirm(`Batalkan pengambilan "${request.itemName}" ini? Stok akan dikembalikan (jika barang stok fisik) dan Kas otomatis dikoreksi.`)) return;
    setCancelError("");
    setCancelPending(true);
    cancelInventoryRequest(request.id)
      .then(() => setOpen(false))
      .catch((err) => setCancelError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCancelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Detail</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">{request.itemName}</div>
            <div className="dialog-body" style={{ display: "grid", gap: "var(--space-3)" }}>
              <div
                className="grid-cols"
                style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-3)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}
              >
                <div>
                  <div className="card-kicker" style={{ fontSize: 11 }}>Jumlah</div>
                  <div style={{ fontWeight: 600 }}>{request.qty}</div>
                </div>
                <div>
                  <div className="card-kicker" style={{ fontSize: 11 }}>Harga satuan</div>
                  <div style={{ fontWeight: 600 }}>{formatRp(request.unitPrice)}</div>
                </div>
                <div>
                  <div className="card-kicker" style={{ fontSize: 11 }}>Total nilai</div>
                  <div style={{ fontWeight: 700 }}>{formatRp(total)}</div>
                </div>
              </div>

              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Peminta</div>
                <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <span className="text-muted">Nama</span>
                    <span style={{ fontWeight: 600 }}>{request.requesterName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <span className="text-muted">Tempat kerja/departemen</span>
                    <span>{request.department || "-"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                    <span className="text-muted">Tanggal</span>
                    <span>{request.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                </div>
              </div>

              {request.note && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  <span className="text-muted">Keterangan: </span>{request.note}
                </p>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span className={request.transactionId ? "tag tag-accent" : "tag tag-neutral"}>
                  {request.transactionId ? "✓ Sudah tercatat di Kas" : "Belum tercatat di Kas"}
                </span>
                {request.cancelledAt && (
                  <span className="tag tag-neutral">
                    Dibatalkan {request.cancelledAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
              {cancelError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{cancelError}</p>}
            </div>
            <div className="dialog-actions">
              {!request.cancelledAt && (
                <button type="button" className="btn btn-ghost" disabled={cancelPending} onClick={handleCancel} style={{ marginRight: "auto" }}>
                  {cancelPending ? "Membatalkan…" : "Batalkan"}
                </button>
              )}
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
