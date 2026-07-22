"use client";

import type { Position } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { EditPositionDialog } from "@/components/EditPositionDialog";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type Pos = Position & { employees: unknown[] };

export function PositionTable({ positions }: { positions: Pos[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(positions, (p, key) => {
    if (key === "name") return p.name;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  if (positions.length === 0) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada posisi. Tambahkan posisi terlebih dahulu sebelum menambah karyawan atau import absensi.</p>;
  }

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <SortableTh label="Nama posisi" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <th>Jenis gaji</th>
            <th>Gaji pokok default</th>
            <th>Karyawan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className="text-muted">{p.salaryType === "harian" ? "Harian" : "Bulanan"}</td>
              <td>{formatRp(p.baseSalary)}</td>
              <td>{p.employees.length}</td>
              <td><EditPositionDialog position={p} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalItems={totalItems} onChange={setPage} />
    </>
  );
}
