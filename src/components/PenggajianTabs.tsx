"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord, Employee, Site, Position, SalaryComponent } from "@prisma/client";
import { bestAttendanceMonth, computeMonthlyPayroll, computeThr, formatRp } from "@/lib/payroll";
import { monthKey } from "@/lib/finance";
import { ThrButton } from "@/components/ThrButton";

type Emp = Employee & { site: Site; position: Position; salaryComponents: SalaryComponent[]; attendance: AttendanceRecord[] };

function monthOptions() {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names.map((n, i) => ({ value: "2026-" + String(i + 1).padStart(2, "0"), label: n + " 2026" }));
}

export function PenggajianTabs({ employees }: { employees: Emp[] }) {
  const [tab, setTab] = useState<"gaji" | "thr">("gaji");
  const [q, setQ] = useState("");
  // Default to whichever month actually has attendance data across all
  // employees, rather than today's real calendar month (usually empty
  // right after an import).
  const [period, setPeriod] = useState(
    () => bestAttendanceMonth(employees.flatMap((e) => e.attendance)) ?? monthKey(new Date()),
  );

  const needle = q.trim().toLowerCase();
  const filteredEmployees = useMemo(
    () => (needle ? employees.filter((e) => [e.empCode, e.name, e.site.name].join(" ").toLowerCase().includes(needle)) : employees),
    [employees, needle],
  );

  const payrollRows = filteredEmployees.map((e) => ({ e, p: computeMonthlyPayroll(e, e.salaryComponents, e.attendance, period) }));
  const totals = payrollRows.reduce(
    (acc, r) => ({
      gajiPokok: acc.gajiPokok + r.p.gajiPokok,
      lembur: acc.lembur + r.p.lembur,
      potongan: acc.potongan + r.p.potongan,
      total: acc.total + r.p.total,
    }),
    { gajiPokok: 0, lembur: 0, potongan: 0, total: 0 },
  );

  const thrRows = filteredEmployees.map((e) => ({ e, t: computeThr(e, e.salaryComponents) }));
  const sumThr = thrRows.reduce((s, r) => s + r.t.thr, 0);
  const sumThrDibayar = thrRows.filter((r) => r.e.thrPaid).reduce((s, r) => s + r.t.thr, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div className="seg" role="radiogroup" style={{ width: "fit-content" }}>
          <label className="seg-opt"><input type="radio" checked={tab === "gaji"} onChange={() => setTab("gaji")} /> Gaji Bulanan</label>
          <label className="seg-opt"><input type="radio" checked={tab === "thr"} onChange={() => setTab("thr")} /> THR</label>
        </div>
        <input
          type="text"
          className="input"
          placeholder="Cari nama, ID, tempat kerja..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 280 }}
        />
      </div>

      {tab === "gaji" && (
        <>
          <div className="field" style={{ maxWidth: 220, marginBottom: "var(--space-4)" }}>
            <label htmlFor="gaji-period">Periode</label>
            <select className="input" id="gaji-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {monthOptions().map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="card"><div className="card-kicker">Gaji pokok</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.gajiPokok)}</div></div>
            <div className="card"><div className="card-kicker">Lembur</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.lembur)}</div></div>
            <div className="card"><div className="card-kicker">Potongan</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.potongan)}</div></div>
            <div className="card"><div className="card-kicker">Total dibayar</div><div className="card-title" style={{ fontSize: 20 }}>{formatRp(totals.total)}</div></div>
          </div>
          <div className="card">
            {payrollRows.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p> : (
              <table className="table">
                <thead><tr><th>ID</th><th>Nama</th><th>Tempat kerja</th><th>Pokok</th><th>Lembur</th><th>Potongan</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {payrollRows.map(({ e, p }) => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.empCode}</td><td>{e.name}</td><td>{e.site.name}</td>
                      <td>{formatRp(p.gajiPokok)}</td><td>{formatRp(p.lembur)}</td><td>-{formatRp(p.potongan)}</td>
                      <td style={{ fontWeight: 600 }}>{formatRp(p.total)}</td>
                      <td><a href={`/print/slip/${e.id}?period=${period}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Cetak slip</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "thr" && (
        <>
          <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div className="card"><div className="card-kicker">Total estimasi THR</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumThr)}</div></div>
            <div className="card"><div className="card-kicker">Sudah dibayar</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumThrDibayar)}</div></div>
            <div className="card"><div className="card-kicker">Belum dibayar</div><div className="card-title" style={{ fontSize: 22 }}>{formatRp(sumThr - sumThrDibayar)}</div></div>
          </div>
          <div className="card">
            {thrRows.length === 0 ? <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p> : (
              <table className="table">
                <thead><tr><th>Nama</th><th>Tempat kerja</th><th>Masa kerja</th><th>THR</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {thrRows.map(({ e, t }) => (
                    <tr key={e.id}>
                      <td>{e.name}</td><td>{e.site.name}</td>
                      <td className="text-muted">{Math.floor(t.months / 12)} tahun {t.months % 12} bulan</td>
                      <td>{formatRp(t.thr)}</td>
                      <td><span className={e.thrPaid ? "tag tag-accent" : "tag tag-outline"}>{e.thrPaid ? "Sudah dibayar" : "Belum dibayar"}</span></td>
                      <td><ThrButton employeeId={e.id} disabled={e.thrPaid} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p style={{ fontSize: 12, opacity: 0.55, marginTop: "var(--space-3)" }}>
            THR dihitung 1x gaji pokok untuk masa kerja ≥12 bulan, proporsional untuk yang kurang — sesuai PP 36/2021.
          </p>
        </>
      )}
    </div>
  );
}
