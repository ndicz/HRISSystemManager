"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord, Employee, Site, Position } from "@prisma/client";
import { RecapDialog } from "@/components/RecapDialog";
import { EditEmployeeDialog } from "@/components/EditEmployeeDialog";
import { SalaryComponentsDialog } from "@/components/SalaryComponentsDialog";
import { bestAttendanceMonth, monthlyAttendanceTally } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { downloadXlsx } from "@/lib/xlsx-writer";

type Emp = Employee & { site: Site; position: Position; attendance: AttendanceRecord[] };

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

export function AbsensiTable({ employees }: { employees: Emp[] }) {
  const [q, setQ] = useState("");
  // Default to whichever month actually has attendance data, rather than
  // today's real calendar month (usually empty right after an import).
  const [period, setPeriod] = useState(
    () => bestAttendanceMonth(employees.flatMap((e) => e.attendance)) ?? monthKey(new Date()),
  );

  const withTally = useMemo(
    () => employees.map((e) => ({ e, tally: monthlyAttendanceTally(e.attendance, period) })),
    [employees, period],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return withTally;
    return withTally.filter(({ e }) => [e.empCode, e.name, e.site.name, e.position.name].join(" ").toLowerCase().includes(needle));
  }, [withTally, q]);

  const totalHadir = filtered.reduce((s, { tally }) => s + tally.presentDays, 0);
  const totalWorkDays = filtered.reduce((s, { tally }) => s + tally.workDays, 0);

  function download() {
    downloadXlsx(
      `absensi-karyawan-${period}.xlsx`,
      [
        ["ID", "Nama", "Tempat Kerja", "Posisi", "Hadir", "Total Hari Kerja"],
        ...filtered.map(({ e, tally }) => [e.empCode, e.name, e.site.name, e.position.name, tally.presentDays, tally.workDays]),
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
          <input
            type="text"
            className="input"
            placeholder="Cari ID, nama, tempat kerja, posisi..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", maxWidth: 320 }}
          />
          <button type="button" className="btn btn-secondary" onClick={download} disabled={filtered.length === 0}>
            Unduh Excel
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
                <th>Kasbon</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ e, tally }) => (
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
                  <td className="text-muted">{e.kasbon > 0 ? "Rp" + e.kasbon.toLocaleString("id-ID") : "-"}</td>
                  <td><RecapDialog employeeId={e.id} employeeName={e.name} /></td>
                  <td><SalaryComponentsDialog employeeId={e.id} employeeName={e.name} /></td>
                  <td><EditEmployeeDialog employee={e} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
