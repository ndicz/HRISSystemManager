"use client";

import type { Employee, Site, Position } from "@prisma/client";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type Emp = Employee & { site: Site; position: Position };

export function ResignedTable({ resigned }: { resigned: Emp[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(resigned, (e, key) => {
    if (key === "empCode") return e.empCode;
    if (key === "name") return e.name;
    if (key === "resignDate") return e.resignDate;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  if (resigned.length === 0) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada karyawan yang resign.</p>;
  }

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <SortableTh label="ID" sortKey="empCode" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <SortableTh label="Nama" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <th>Tempat kerja</th>
            <th>Posisi</th>
            <SortableTh label="Tanggal resign" sortKey="resignDate" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <th>Alasan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((e) => (
            <tr key={e.id}>
              <td className="text-muted">{e.empCode}</td>
              <td>{e.name}</td>
              <td>{e.site.name}</td>
              <td>{e.position.name}</td>
              <td className="text-muted">{e.resignDate ? e.resignDate.toLocaleDateString("id-ID") : "-"}</td>
              <td>{e.resignReason ?? "-"}</td>
              <td>
                {e.resignDate && (
                  <a href={`/print/final-settlement/${e.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    Cetak slip terakhir
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalItems={totalItems} onChange={setPage} />
    </>
  );
}
