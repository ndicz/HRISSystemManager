"use client";

import type { Site } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type S = Site & { employees: unknown[] };

export function SiteTable({ sites }: { sites: S[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(sites, (s, key) => {
    if (key === "name") return s.name;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  if (sites.length === 0) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada tempat kerja.</p>;
  }

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <SortableTh label="Nama lokasi" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <th>Alamat</th>
            <th>Penanggung jawab</th>
            <th>UMR/UMK</th>
            <th>Karyawan</th>
          </tr>
        </thead>
        <tbody>
          {paged.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="text-muted">{s.address}</td>
              <td>{s.supervisor}</td>
              <td>{formatRp(s.umr)}</td>
              <td>{s.employees.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalItems={totalItems} onChange={setPage} />
    </>
  );
}
