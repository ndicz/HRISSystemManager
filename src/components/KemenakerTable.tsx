"use client";

import { useMemo, useState } from "react";
import { formatRp } from "@/lib/payroll";

type Row = {
  id: string;
  name: string;
  siteName: string;
  umrWilayah: number;
  gajiPokok: number;
  compliant: boolean;
};

export function KemenakerTable({ rows }: { rows: Row[] }) {
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
              <th>UMR wilayah</th>
              <th>Gaji pokok</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.siteName}</td>
                <td>{formatRp(r.umrWilayah)}</td>
                <td>{formatRp(r.gajiPokok)}</td>
                <td>
                  <span className={r.compliant ? "tag tag-accent" : "tag tag-neutral"}>{r.compliant ? "Sesuai UMR" : "Di bawah UMR"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
