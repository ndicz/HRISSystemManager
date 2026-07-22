"use client";

import { useMemo, useState } from "react";
import type { Employee, Site, Position, SalaryComponent } from "@prisma/client";
import { EditEmployeeDialog } from "@/components/EditEmployeeDialog";
import { SalaryComponentsDialog } from "@/components/SalaryComponentsDialog";
import { EmployeeProfileDialog } from "@/components/EmployeeProfileDialog";
import { ResignDialog } from "@/components/ResignDialog";
import { downloadCsv } from "@/lib/csv";
import { baseSalary, formatRp } from "@/lib/payroll";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type Emp = Employee & { site: Site; position: Position; salaryComponents: SalaryComponent[] };
type SiteOption = { id: string; name: string };

export function KaryawanTable({ employees, sites }: { employees: Emp[]; sites: SiteOption[] }) {
  const [q, setQ] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const siteOptions = useMemo(() => [...new Set(employees.map((e) => e.site.name))].sort(), [employees]);
  const positionOptions = useMemo(() => [...new Set(employees.map((e) => e.position.name))].sort(), [employees]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees.filter((e) => {
      if (siteFilter && e.site.name !== siteFilter) return false;
      if (positionFilter && e.position.name !== positionFilter) return false;
      if (needle && ![e.empCode, e.name, e.site.name, e.position.name, e.contractType].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [employees, q, siteFilter, positionFilter]);
  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(filtered, (e, key) => {
    if (key === "empCode") return e.empCode;
    if (key === "name") return e.name;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  function download() {
    downloadCsv(
      "karyawan.csv",
      [
        ["ID", "Nama", "Tempat Kerja", "Posisi", "Kontrak", "Kontrak Berakhir", "Gaji Pokok", "BPJS Kesehatan", "BPJS Ketenagakerjaan", "Kasbon", "Kasbon Dicicil (bulan)", "Kuota Cuti"],
        ...sorted.map((e) => [
          e.empCode,
          e.name,
          e.site.name,
          e.position.name,
          e.contractType,
          e.contractEnd ? e.contractEnd.toLocaleDateString("id-ID") : "-",
          baseSalary(e.salaryComponents),
          e.bpjsKesehatanOverride ?? "Otomatis",
          e.bpjsKetenagakerjaanOverride ?? "Otomatis",
          e.kasbon,
          e.kasbonCicilan,
          e.cutiKuota,
        ]),
      ],
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <input
            type="text"
            className="input"
            placeholder="Cari nama, ID, tempat kerja, posisi..."
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
        <button type="button" className="btn btn-secondary" onClick={download} disabled={filtered.length === 0}>
          Unduh CSV
        </button>
      </div>
      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? 'Belum ada karyawan. Klik "Tambah karyawan" untuk mulai.' : "Tidak ada hasil."}</p>
      ) : (
        <>
        <table className="table">
          <thead>
            <tr>
              <SortableTh label="ID" sortKey="empCode" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableTh label="Nama" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th>Tempat kerja</th>
              <th>Posisi</th>
              <th>Kontrak</th>
              <th>Gaji Pokok</th>
              <th>BPJS Kes</th>
              <th>BPJS TK</th>
              <th></th>
              <th></th>
              <th></th>
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
                <td>
                  <span className={e.contractType === "PKWTT" ? "tag tag-neutral" : "tag tag-outline"}>
                    {e.contractType}
                    {e.contractEnd ? " · s.d " + e.contractEnd.toLocaleDateString("id-ID") : ""}
                  </span>
                </td>
                <td>{formatRp(baseSalary(e.salaryComponents))}</td>
                <td className="text-muted">{e.bpjsKesehatanOverride !== null ? formatRp(e.bpjsKesehatanOverride) : "Otomatis"}</td>
                <td className="text-muted">{e.bpjsKetenagakerjaanOverride !== null ? formatRp(e.bpjsKetenagakerjaanOverride) : "Otomatis"}</td>
                <td><EditEmployeeDialog employee={e} sites={sites} /></td>
                <td><SalaryComponentsDialog employeeId={e.id} employeeName={e.name} /></td>
                <td><EmployeeProfileDialog employee={e} /></td>
                <td><ResignDialog employeeId={e.id} employeeName={e.name} /></td>
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
