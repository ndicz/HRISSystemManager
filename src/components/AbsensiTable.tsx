"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord, Employee, Site, Position } from "@prisma/client";
import { RecapDialog } from "@/components/RecapDialog";
import { EditEmployeeDialog } from "@/components/EditEmployeeDialog";
import { SalaryComponentsDialog } from "@/components/SalaryComponentsDialog";
import { bestAttendanceMonth, formatRp, kasbonPerBulan, monthlyAttendanceTally } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { downloadXlsx } from "@/lib/xlsx-writer";
import { Pagination, usePagedRows } from "@/components/Pagination";
import { SortableTh, useSortableRows } from "@/components/SortableHeader";

type Emp = Employee & { site: Site; position: Position; attendance: Pick<AttendanceRecord, "date" | "status" | "lateMin">[] };
type SiteOption = { id: string; name: string };

function attendanceTag(presentDays: number, workDays: number) {
  if (workDays <= 0) return "tag tag-neutral";
  const pct = presentDays / workDays;
  if (pct >= 0.9) return "tag tag-accent";
  if (pct >= 0.75) return "tag tag-outline";
  return "tag tag-neutral";
}

function monthOptions() {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names.map((n, i) => ({ value: "2026-" + String(i + 1).padStart(2, "0"), label: n + " 2026" }));
}

export function AbsensiTable({ employees, sites }: { employees: Emp[]; sites: SiteOption[] }) {
  const [q, setQ] = useState("");
  // Default to whichever month actually has attendance data, rather than
  // today's real calendar month (usually empty right after an import).
  const [period, setPeriod] = useState(
    () => bestAttendanceMonth(employees.flatMap((e) => e.attendance)) ?? monthKey(new Date()),
  );

  const [siteFilter, setSiteFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const siteOptions = useMemo(() => [...new Set(employees.map((e) => e.site.name))].sort(), [employees]);
  const positionOptions = useMemo(() => [...new Set(employees.map((e) => e.position.name))].sort(), [employees]);

  const withTally = useMemo(
    () => employees.map((e) => ({ e, tally: monthlyAttendanceTally(e.attendance, period) })),
    [employees, period],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withTally.filter(({ e }) => {
      if (siteFilter && e.site.name !== siteFilter) return false;
      if (positionFilter && e.position.name !== positionFilter) return false;
      if (needle && ![e.empCode, e.name, e.site.name, e.position.name].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [withTally, q, siteFilter, positionFilter]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableRows(filtered, ({ e }, key) => {
    if (key === "empCode") return e.empCode;
    if (key === "name") return e.name;
    return null;
  });
  const { paged, page, setPage, totalItems } = usePagedRows(sorted);

  const totalHadir = filtered.reduce((s, { tally }) => s + tally.presentDays, 0);
  const totalWorkDays = filtered.reduce((s, { tally }) => s + tally.workDays, 0);

  function download() {
    downloadXlsx(
      `absensi-karyawan-${period}.xlsx`,
      [
        ["ID", "Nama", "Tempat Kerja", "Posisi", "Hadir", "Total Hari Kerja"],
        ...sorted.map(({ e, tally }) => [e.empCode, e.name, e.site.name, e.position.name, tally.presentDays, tally.workDays]),
      ],
    );
  }

  return (
    <div>
      <div className="field" style={{ maxWidth: 220, marginBottom: "var(--space-4)" }}>
        <label htmlFor="absensi-period">Periode</label>
        <select className="input" id="absensi-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {monthOptions().map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="card">
          <div className="card-kicker">Total karyawan</div>
          <div className="card-title">{employees.length}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Hadir bulan ini</div>
          <div className="card-title">{totalHadir}</div>
        </div>
        <div className="card">
          <div className="card-kicker">% Kehadiran</div>
          <div className="card-title">{totalWorkDays > 0 ? ((totalHadir / totalWorkDays) * 100).toFixed(1) : "0.0"}%</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <input
              type="text"
              className="input"
              placeholder="Cari ID, nama, tempat kerja, posisi..."
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
            Unduh Excel
          </button>
        </div>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p>
        ) : (
          <>
          <table className="table">
            <thead>
              <tr>
                <SortableTh label="ID" sortKey="empCode" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Nama" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <th>Tempat kerja</th>
                <th>Posisi</th>
                <th>Kehadiran</th>
                <th>Kasbon</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(({ e, tally }) => (
                <tr key={e.id}>
                  <td className="text-muted">{e.empCode}</td>
                  <td>{e.name}</td>
                  <td>{e.site.name}</td>
                  <td>{e.position.name}</td>
                  <td>
                    <span className={attendanceTag(tally.presentDays, tally.workDays)}>
                      {tally.presentDays}/{tally.workDays} hari
                    </span>
                  </td>
                  <td className="text-muted">
                    {e.kasbon > 0 ? (
                      e.kasbonCicilan > 1 ? (
                        <>
                          {formatRp(kasbonPerBulan(e.kasbon, e.kasbonCicilan))}/bln
                          <span style={{ opacity: 0.7 }}> ({e.kasbonCicilan}x dari {formatRp(e.kasbon)})</span>
                        </>
                      ) : (
                        formatRp(e.kasbon)
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                  <td><RecapDialog employeeId={e.id} employeeName={e.name} /></td>
                  <td><SalaryComponentsDialog employeeId={e.id} employeeName={e.name} /></td>
                  <td><EditEmployeeDialog employee={e} sites={sites} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalItems={totalItems} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
