"use client";

import { useMemo, useState } from "react";
import type { Employee, Site, Position } from "@prisma/client";
import { RecapDialog } from "@/components/RecapDialog";
import { downloadCsv } from "@/lib/csv";

type Emp = Employee & { site: Site; position: Position };

function attendanceTag(presentDays: number, workDays: number) {
  if (workDays <= 0) return "tag tag-neutral";
  const pct = presentDays / workDays;
  if (pct >= 0.9) return "tag tag-accent";
  if (pct >= 0.75) return "tag tag-outline";
  return "tag tag-neutral";
}

export function AbsensiTable({ employees }: { employees: Emp[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((e) => [e.empCode, e.name, e.site.name, e.position.name].join(" ").toLowerCase().includes(needle));
  }, [employees, q]);

  function download() {
    downloadCsv(
      "absensi-karyawan.csv",
      [
        ["ID", "Nama", "Tempat Kerja", "Posisi", "Hadir", "Total Hari Kerja", "Status Terkini"],
        ...filtered.map((e) => [e.empCode, e.name, e.site.name, e.position.name, e.presentDays, e.workDays, e.attStatus]),
      ],
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <input
          type="text"
          className="input"
          placeholder="Cari ID, nama, tempat kerja, posisi..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 320 }}
        />
        <button type="button" className="btn btn-secondary" onClick={download} disabled={filtered.length === 0}>
          Unduh CSV
        </button>
      </div>
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama</th>
              <th>Tempat kerja</th>
              <th>Posisi</th>
              <th>Kehadiran</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="text-muted">{e.empCode}</td>
                <td>{e.name}</td>
                <td>{e.site.name}</td>
                <td>{e.position.name}</td>
                <td>
                  <span className={attendanceTag(e.presentDays, e.workDays)}>
                    {e.presentDays}/{e.workDays} hari
                  </span>
                </td>
                <td><RecapDialog employeeId={e.id} employeeName={e.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
