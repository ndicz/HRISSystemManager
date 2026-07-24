"use client";

import { useMemo, useState } from "react";
import type { LeaveRequest, Employee, Site, Position } from "@prisma/client";
import { LeaveActions } from "@/components/LeaveActions";
import { EditLeaveRequestDialog } from "@/components/EditLeaveRequestDialog";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

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

type Req = LeaveRequest & { employee: Employee & { site: Site; position: Position } };

export function CutiTable({ requests }: { requests: Req[] }) {
  const [q, setQ] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const siteOptions = useMemo(() => [...new Set(requests.map((r) => r.employee.site.name))].sort(), [requests]);
  const positionOptions = useMemo(() => [...new Set(requests.map((r) => r.employee.position.name))].sort(), [requests]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return requests.filter((r) => {
      if (siteFilter && r.employee.site.name !== siteFilter) return false;
      if (positionFilter && r.employee.position.name !== positionFilter) return false;
      if (needle && ![r.employee.name, r.type, r.reason, statusLabel(r.status)].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [requests, q, siteFilter, positionFilter]);
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(filtered, (r, key) => {
    if (key === "name") return r.employee.name;
    if (key === "startDate") return r.startDate;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  return (
    <div className="card">
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <input
          type="text"
          className="input"
          placeholder="Cari nama, jenis, alasan..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 260 }}
        />
        <select className="input" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Semua tempat kerja</option>
          {siteOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Semua posisi</option>
          {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{requests.length === 0 ? "Belum ada pengajuan cuti." : "Tidak ada hasil."}</p>
      ) : (
        <>
        <table className="table">
          <thead>
            <tr>
              <SortableTh label="Nama" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th>Jenis</th>
              <SortableTh label="Periode" sortKey="startDate" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th>Alasan</th>
              <th>Status</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id}>
                <td>{r.employee.name}</td>
                <td>{r.type}</td>
                <td className="text-muted">
                  {r.startDate.toLocaleDateString("id-ID")} – {r.endDate.toLocaleDateString("id-ID")}
                </td>
                <td>{r.reason}</td>
                <td><span className={statusTag(r.status)}>{statusLabel(r.status)}</span></td>
                <td><EditLeaveRequestDialog request={{ id: r.id, employeeName: r.employee.name, type: r.type, startDate: r.startDate, endDate: r.endDate, reason: r.reason }} /></td>
                <td><LeaveActions id={r.id} disabled={r.status !== "menunggu"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} totalItems={totalItems} onChange={setPage} />
        </>
      )}
    </div>
  );
}
