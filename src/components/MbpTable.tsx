"use client";

import { useState, useTransition } from "react";
import { advanceMbpStatus, rejectMbpByClient, cancelMbp, convertMbpToInvoice } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";
import { invoiceBjSubtotal } from "@/lib/finance";

type MbpRow = {
  id: string;
  mbpNo: string;
  clientName: string;
  date: Date;
  jobTitle: string | null;
  status: string;
  invoiceBjId: string | null;
  items: { qty: number; price: number }[];
};

const STATUS_TAG: Record<string, string> = {
  draft: "tag tag-outline",
  terkirim: "tag tag-accent",
  disetujui_klien: "tag tag-accent",
  ditolak_klien: "tag tag-danger",
  dibatalkan: "tag tag-danger",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  terkirim: "Terkirim",
  disetujui_klien: "Disetujui Klien",
  ditolak_klien: "Ditolak Klien",
  dibatalkan: "Dibatalkan",
};
const ADVANCE_LABEL: Record<string, string> = { draft: "Kirim ke klien", terkirim: "Tandai disetujui klien" };

function RowActions({ mbp }: { mbp: MbpRow }) {
  const [advPending, startAdv] = useTransition();
  const [rejPending, startRej] = useTransition();
  const [cancelPending, startCancel] = useTransition();
  const [convPending, startConv] = useTransition();
  const [error, setError] = useState("");

  const canAdvance = mbp.status === "draft" || mbp.status === "terkirim";
  const canReject = mbp.status === "terkirim";
  const canCancel = !mbp.invoiceBjId && (mbp.status === "draft" || mbp.status === "terkirim" || mbp.status === "disetujui_klien");
  const canConvert = mbp.status === "disetujui_klien" && !mbp.invoiceBjId;

  function run(action: () => Promise<void>, start: typeof startAdv, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError("");
    start(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      {canAdvance && (
        <button type="button" className="btn btn-ghost" disabled={advPending} onClick={() => run(() => advanceMbpStatus(mbp.id), startAdv)}>
          {ADVANCE_LABEL[mbp.status]}
        </button>
      )}
      {canReject && (
        <button type="button" className="btn btn-ghost" disabled={rejPending} onClick={() => run(() => rejectMbpByClient(mbp.id), startRej, `Tandai MBP "${mbp.mbpNo}" ditolak klien?`)}>
          Klien menolak
        </button>
      )}
      {canConvert && (
        <button type="button" className="btn btn-primary" disabled={convPending} onClick={() => run(() => convertMbpToInvoice(mbp.id), startConv)}>
          {convPending ? "Memproses…" : "Jadikan Invoice"}
        </button>
      )}
      {mbp.invoiceBjId && <span className="tag tag-accent">Sudah jadi Invoice</span>}
      <a className="btn btn-ghost" href={`/print/mbp/${mbp.id}`} target="_blank" rel="noopener noreferrer">Cetak</a>
      {canCancel && (
        <button type="button" className="btn btn-ghost" disabled={cancelPending} onClick={() => run(() => cancelMbp(mbp.id), startCancel, `Batalkan MBP "${mbp.mbpNo}"?`)}>
          Batalkan
        </button>
      )}
      {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
    </span>
  );
}

export function MbpTable({ mbps }: { mbps: MbpRow[] }) {
  if (mbps.length === 0) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada MBP.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>No. MBP</th>
            <th>Klien</th>
            <th>Tanggal</th>
            <th>Pekerjaan</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {mbps.map((m) => (
            <tr key={m.id}>
              <td>{m.mbpNo}</td>
              <td>{m.clientName}</td>
              <td className="text-muted">{m.date.toLocaleDateString("id-ID")}</td>
              <td className="text-muted">{m.jobTitle || "-"}</td>
              <td style={{ fontWeight: 600 }}>{formatRp(invoiceBjSubtotal(m.items))}</td>
              <td><span className={STATUS_TAG[m.status]}>{STATUS_LABEL[m.status]}</span></td>
              <td><RowActions mbp={m} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
