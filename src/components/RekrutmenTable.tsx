"use client";

import { useMemo, useState } from "react";
import type { Candidate } from "@prisma/client";
import { CandidateActions } from "@/components/CandidateActions";
import { EditCandidateDialog } from "@/components/EditCandidateDialog";

type PositionOption = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  lamaran: "Lamaran Masuk",
  interview: "Interview",
  diterima: "Diterima",
  aktif: "Aktif sebagai karyawan",
  ditolak: "Ditolak",
};
function statusTag(status: string) {
  if (status === "aktif") return "tag tag-accent";
  if (status === "diterima") return "tag tag-outline";
  if (status === "ditolak") return "tag tag-neutral";
  return "tag tag-outline";
}

export function RekrutmenTable({ candidates, positions }: { candidates: Candidate[]; positions: PositionOption[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((c) => [c.name, c.position, STATUS_LABEL[c.status]].join(" ").toLowerCase().includes(needle));
  }, [candidates, q]);

  return (
    <div className="card">
      <input
        type="text"
        className="input"
        placeholder="Cari nama, posisi..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
      />
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{candidates.length === 0 ? "Belum ada kandidat." : "Tidak ada hasil."}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Posisi dilamar</th>
              <th>Tanggal lamar</th>
              <th>Status</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.position}</td>
                <td className="text-muted">{c.appliedDate.toLocaleDateString("id-ID")}</td>
                <td><span className={statusTag(c.status)}>{STATUS_LABEL[c.status]}</span></td>
                <td><EditCandidateDialog candidate={c} positions={positions} /></td>
                <td><CandidateActions id={c.id} status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
