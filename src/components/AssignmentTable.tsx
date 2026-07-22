"use client";

import type { Assignment, Employee } from "@prisma/client";
import { formatRp } from "@/lib/payroll";
import { AssignmentActions } from "@/components/AssignmentActions";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type A = Assignment & { employee: Employee };

export function AssignmentTable({ assignments }: { assignments: A[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(assignments, (a, key) => {
    if (key === "name") return a.employee.name;
    if (key === "title") return a.title;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  if (assignments.length === 0) {
    return <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada penugasan tambahan.</p>;
  }

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <SortableTh label="Karyawan" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <SortableTh label="Judul" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
            <th>Mandays</th>
            <th>Biaya</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((a) => (
            <tr key={a.id}>
              <td>{a.employee.name}</td>
              <td>{a.title}</td>
              <td className="text-muted">{a.mandays} hari</td>
              <td>{formatRp(a.cost)}</td>
              <td>
                <span className={a.status === "selesai" ? "tag tag-accent" : "tag tag-outline"}>
                  {a.status === "selesai" ? "Selesai" : "Berjalan"}
                </span>
              </td>
              <td><AssignmentActions id={a.id} disabled={a.status === "selesai"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalItems={totalItems} onChange={setPage} />
    </>
  );
}
