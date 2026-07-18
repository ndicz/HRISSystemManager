"use client";

import { useMemo, useState } from "react";
import type { Employee, Site, Position } from "@prisma/client";
import { EditEmployeeDialog } from "@/components/EditEmployeeDialog";
import { SalaryComponentsDialog } from "@/components/SalaryComponentsDialog";
import { ResignDialog } from "@/components/ResignDialog";
import { downloadCsv } from "@/lib/csv";

type Emp = Employee & { site: Site; position: Position };

export function KaryawanTable({ employees }: { employees: Emp[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((e) =>
      [e.empCode, e.name, e.site.name, e.position.name, e.contractType].join(" ").toLowerCase().includes(needle),
    );
  }, [employees, q]);

  function download() {
    downloadCsv(
      "karyawan.csv",
      [
        ["ID", "Nama", "Tempat Kerja", "Posisi", "Kontrak", "Kontrak Berakhir", "Kasbon", "Kuota Cuti"],
        ...filtered.map((e) => [
          e.empCode,
          e.name,
          e.site.name,
          e.position.name,
          e.contractType,
          e.contractEnd ? e.contractEnd.toLocaleDateString("id-ID") : "-",
          e.kasbon,
          e.cutiKuota,
        ]),
      ],
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <input
          type="text"
          className="input"
          placeholder="Cari nama, ID, tempat kerja, posisi..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 320 }}
        />
        <button type="button" className="btn btn-secondary" onClick={download} disabled={filtered.length === 0}>
          Unduh CSV
        </button>
      </div>
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? 'Belum ada karyawan. Klik "Tambah karyawan" untuk mulai.' : "Tidak ada hasil."}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama</th>
              <th>Tempat kerja</th>
              <th>Posisi</th>
              <th>Kontrak</th>
              <th></th>
              <th></th>
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
                  <span className={e.contractType === "PKWTT" ? "tag tag-neutral" : "tag tag-outline"}>
                    {e.contractType}
                    {e.contractEnd ? " · s.d " + e.contractEnd.toLocaleDateString("id-ID") : ""}
                  </span>
                </td>
                <td><EditEmployeeDialog employee={e} /></td>
                <td><SalaryComponentsDialog employeeId={e.id} employeeName={e.name} /></td>
                <td><ResignDialog employeeId={e.id} employeeName={e.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
