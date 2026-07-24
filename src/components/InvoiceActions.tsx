"use client";

import { useState, useTransition } from "react";
import { advanceInvoiceStatus, deleteInvoice, cancelInvoice } from "@/app/(app)/klien/actions";

const LABEL: Record<string, string> = { draft: "Kirim tagihan", terkirim: "Tandai lunas", lunas: "Lunas", dibatalkan: "Dibatalkan" };

export function InvoiceActions({ id, status, invoiceNo }: { id: string; status: string; invoiceNo: string }) {
  const [pending, startTransition] = useTransition();
  const [delPending, startDelTransition] = useTransition();
  const [cancelPending, startCancelTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    if (!window.confirm(`Hapus invoice "${invoiceNo}"? Aksi ini tidak bisa dibatalkan.`)) return;
    setError("");
    startDelTransition(async () => {
      try {
        await deleteInvoice(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleCancel() {
    if (!window.confirm(`Batalkan invoice "${invoiceNo}" yang sudah lunas? Kas akan otomatis dikoreksi (dicatat transaksi keluar sebesar nilai invoice ini).`)) return;
    setError("");
    startCancelTransition(async () => {
      try {
        await cancelInvoice(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={status === "lunas" || status === "dibatalkan" || pending}
        onClick={() => startTransition(() => advanceInvoiceStatus(id))}
      >
        {LABEL[status]}
      </button>
      {(status === "draft" || status === "terkirim") && (
        <button type="button" className="btn btn-ghost" disabled={delPending} onClick={handleDelete}>
          Hapus
        </button>
      )}
      {status === "lunas" && (
        <button type="button" className="btn btn-ghost" disabled={cancelPending} onClick={handleCancel}>
          Batalkan
        </button>
      )}
      {error && <span style={{ fontSize: 12, color: "var(--color-accent-800)" }}>{error}</span>}
    </span>
  );
}
