"use client";

import { useState, useTransition } from "react";
import { decideMbpRequest } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";

type RequestRow = {
  id: string;
  itemName: string;
  unit: string;
  qty: number;
  cost: number;
  requesterName: string;
  siteName: string | null;
  note: string | null;
  status: string;
  mbpId: string | null;
  createdAt: Date;
};

const STATUS_TAG: Record<string, string> = { menunggu: "tag tag-outline", disetujui: "tag tag-accent", ditolak: "tag tag-danger" };
const STATUS_LABEL: Record<string, string> = { menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak" };

function DecisionButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function decide(decision: "disetujui" | "ditolak") {
    setError("");
    startTransition(async () => {
      try {
        await decideMbpRequest(id, decision);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => decide("disetujui")}>ACC</button>
      <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => decide("ditolak")}>Tolak</button>
      {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
    </span>
  );
}

export function MbpRequestTable({ requests }: { requests: RequestRow[] }) {
  if (requests.length === 0) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada permintaan barang.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Barang</th>
            <th>Jumlah</th>
            <th>Cost</th>
            <th>Peminta</th>
            <th>Tempat kerja</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="text-muted">{r.createdAt.toLocaleDateString("id-ID")}</td>
              <td>{r.itemName}</td>
              <td>{r.qty} {r.unit}</td>
              <td>{formatRp(r.cost * r.qty)}</td>
              <td>{r.requesterName}</td>
              <td className="text-muted">{r.siteName || "-"}</td>
              <td>
                <span className={STATUS_TAG[r.status]}>{STATUS_LABEL[r.status]}</span>
                {r.mbpId && <span className="tag tag-outline" style={{ marginLeft: 6 }}>Sudah di MBP</span>}
              </td>
              <td>{r.status === "menunggu" && <DecisionButtons id={r.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
