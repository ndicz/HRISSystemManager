"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideMbpRequest } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";
import { Avatar } from "@/components/Avatar";

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
  decisionNote: string | null;
  mbpId: string | null;
  createdAt: Date;
};

const STATUS_TAG: Record<string, string> = { menunggu: "tag tag-outline", disetujui: "tag tag-accent", ditolak: "tag tag-danger" };
const STATUS_LABEL: Record<string, string> = { menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak" };

// ACC no longer happens here — pulling a request into an MBP (see
// CreateMbpDialog) is what approves it now. This table only offers Tolak,
// for requests that should never become an MBP at all (duplicate, wrong
// item, etc.).
function RejectButton({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [reason, setReason] = useState("");

  function confirm() {
    setError("");
    startTransition(async () => {
      try {
        await decideMbpRequest(id, "ditolak", reason);
        setDrafting(false);
        setReason("");
        router.refresh();
        onChanged?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (drafting) {
    return (
      <div style={{ display: "grid", gap: 4, minWidth: 200 }}>
        <textarea
          className="input"
          rows={2}
          style={{ fontSize: 12, minHeight: "auto" }}
          placeholder="Alasan penolakan (opsional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={confirm} style={{ padding: "4px 10px", fontSize: 12 }}>
            {pending ? "…" : "Konfirmasi Tolak"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => { setDrafting(false); setReason(""); }} style={{ padding: "4px 10px", fontSize: 12 }}>
            Batal
          </button>
        </span>
        {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
      </div>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
      <button type="button" className="btn btn-ghost" onClick={() => setDrafting(true)}>Tolak</button>
      {error && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</span>}
    </span>
  );
}

export function MbpRequestTable({
  requests, showDecisions = true, hideCost = false, onChanged,
}: {
  requests: RequestRow[]; showDecisions?: boolean; hideCost?: boolean; onChanged?: () => void;
}) {
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
            {!hideCost && <th>Cost</th>}
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
              {!hideCost && <td>{formatRp(r.cost * r.qty)}</td>}
              <td><span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}><Avatar name={r.requesterName} size={24} />{r.requesterName}</span></td>
              <td className="text-muted">{r.siteName || "-"}</td>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className={STATUS_TAG[r.status]}>{STATUS_LABEL[r.status]}</span>
                  {r.mbpId && <span className="tag tag-outline">Sudah di MBP</span>}
                  {r.decisionNote && <span style={{ fontSize: 11, opacity: 0.6 }}>&ldquo;{r.decisionNote}&rdquo;</span>}
                </span>
              </td>
              <td>{showDecisions && r.status === "menunggu" && <RejectButton id={r.id} onChanged={onChanged} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
