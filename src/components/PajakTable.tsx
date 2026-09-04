"use client";

import { useMemo, useState } from "react";
import { formatRp } from "@/lib/payroll";

type Row = {
  id: string;
  name: string;
  siteName: string;
  brutoBulan: number;
  pkp: number;
  pph21Bulan: number;
};

export function PajakTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => [r.name, r.siteName].join(" ").toLowerCase().includes(needle));
  }, [rows, q]);

  return (
    <div className="card">
      <input
        type="text"
        className="input"
        placeholder="Cari nama, tempat kerja..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: "var(--space-3)", width: "100%", maxWidth: 320 }}
      />
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{rows.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Tempat kerja</th>
              <th>Bruto/bulan</th>
              <th>PKP/tahun</th>
              <th>PPh 21/bulan</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.siteName}</td>
                <td>{formatRp(r.brutoBulan)}</td>
                <td>{formatRp(r.pkp)}</td>
                <td>{formatRp(r.pph21Bulan)}</td>
                <td>
                  <span className={r.pkp > 0 ? "tag tag-accent" : "tag tag-neutral"}>{r.pkp > 0 ? "Kena Pajak" : "Nihil"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
