"use client";

import { useMemo, useState } from "react";
import type { LeaveRequest, Employee } from "@prisma/client";
import { LeaveActions } from "@/components/LeaveActions";

function statusTag(status: string) {
  if (status === "disetujui") return "tag tag-accent";
  if (status === "ditolak") return "tag tag-neutral";
  return "tag tag-outline";
}
function statusLabel(status: string) {
  if (status === "disetujui") return "Disetujui";
  if (status === "ditolak") return "Ditolak";
  return "Menunggu";
}

type Req = LeaveRequest & { employee: Employee };

export function CutiTable({ requests }: { requests: Req[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((r) => [r.employee.name, r.type, r.reason, statusLabel(r.status)].join(" ").toLowerCase().includes(needle));
  }, [requests, q]);

  return (
    <div className="card">
      <input
        type="text"
        className="input"
        placeholder="Cari nama, jenis, alasan..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
      />
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{requests.length === 0 ? "Belum ada pengajuan cuti." : "Tidak ada hasil."}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Jenis</th>
              <th>Periode</th>
              <th>Alasan</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.employee.name}</td>
                <td>{r.type}</td>
                <td className="text-muted">
                  {r.startDate.toLocaleDateString("id-ID")} – {r.endDate.toLocaleDateString("id-ID")}
                </td>
                <td>{r.reason}</td>
                <td><span className={statusTag(r.status)}>{statusLabel(r.status)}</span></td>
                <td><LeaveActions id={r.id} disabled={r.status !== "menunggu"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
