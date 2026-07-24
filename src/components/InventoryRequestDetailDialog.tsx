"use client";

import { useState } from "react";
import type { InventoryRequest } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { cancelInventoryRequest, completeInventoryRequest } from "@/app/(app)/gudang/actions";

const STATUS_TAG: Record<string, string> = {
  berjalan: "tag tag-outline",
  selesai: "tag tag-accent",
  dibatalkan: "tag tag-neutral",
};
const STATUS_LABEL: Record<string, string> = {
  berjalan: "Berjalan",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export function InventoryRequestDetailDialog({ request }: { request: InventoryRequest }) {
  const [open, setOpen] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelPending, setCancelPending] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [completePending, setCompletePending] = useState(false);
  const total = request.qty * request.unitPrice;

  function handleCancel() {
    const msg = request.status === "selesai"
      ? `Batalkan pengambilan "${request.itemName}" ini? Stok akan dikembalikan (jika barang stok fisik) dan Kas otomatis dikoreksi.`
      : `Batalkan pengambilan "${request.itemName}" ini?`;
    if (!window.confirm(msg)) return;
    setCancelError("");
    setCancelPending(true);
    cancelInventoryRequest(request.id)
      .then(() => setOpen(false))
      .catch((err) => setCancelError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCancelPending(false));
  }

  function handleComplete() {
    setCompleteError("");
    setCompletePending(true);
    completeInventoryRequest(request.id)
      .then(() => setOpen(false))
      .catch((err) => setCompleteError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCompletePending(false));
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
                    <span className="text-muted">Tanggal diajukan</span>
                    <span>{request.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                  {request.targetDate && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                      <span className="text-muted">Target selesai</span>
                      <span>{request.targetDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                  )}
                  {request.completedAt && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                      <span className="text-muted">Selesai pada</span>
                      <span>{request.completedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                  )}
                </div>
              </div>

              {request.note && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  <span className="text-muted">Keterangan: </span>{request.note}
                </p>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span className={STATUS_TAG[request.status]}>{STATUS_LABEL[request.status]}</span>
                <span className={request.transactionId ? "tag tag-accent" : "tag tag-neutral"}>
                  {request.transactionId ? "✓ Sudah tercatat di Kas" : "Belum tercatat di Kas"}
                </span>
              </div>
              {request.status === "berjalan" && (
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
                  Stok belum dikurangi dan belum tercatat di Kas — tandai &ldquo;Selesai&rdquo; setelah barang benar-benar diserahkan.
                </p>
              )}
              {completeError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{completeError}</p>}
              {cancelError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{cancelError}</p>}
            </div>
            <div className="dialog-actions">
              {request.status !== "dibatalkan" && (
                <button type="button" className="btn btn-ghost" disabled={cancelPending} onClick={handleCancel} style={{ marginRight: "auto" }}>
                  {cancelPending ? "Membatalkan…" : "Batalkan"}
                </button>
              )}
              {request.status === "berjalan" && (
                <button type="button" className="btn btn-secondary" disabled={completePending} onClick={handleComplete}>
                  {completePending ? "Menyimpan…" : "Tandai Selesai"}
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
