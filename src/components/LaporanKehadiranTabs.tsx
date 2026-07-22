"use client";

import { useMemo, useState } from "react";
import {
  monthlyAttendanceBuckets,
  yearlyAttendanceBuckets,
  employeeAttendanceSummary,
  type AttendanceBucket,
} from "@/lib/attendanceReport";
import { Pagination, usePagedRows } from "@/components/Pagination";

type AttendanceRow = { date: Date; status: string; employeeId: string };
type Emp = { id: string; name: string; site: { name: string }; position: { name: string } };

const LEGEND: { key: keyof Omit<AttendanceBucket, "key" | "label">; label: string; color: string }[] = [
  { key: "hadir", label: "Hadir", color: "var(--color-accent-600)" },
  { key: "izin", label: "Izin", color: "var(--color-accent-2-600)" },
  { key: "alpha", label: "Alpha", color: "var(--color-neutral-800)" },
  { key: "libur", label: "Hari Libur", color: "var(--color-neutral-300)" },
];

function BarChart({ buckets }: { buckets: AttendanceBucket[] }) {
  const maxTotal = Math.max(1, ...buckets.map((b) => b.hadir + b.izin + b.alpha + b.libur));

  return (
    <div>
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-3)", fontSize: 12 }}>
        {LEGEND.map((l) => (
          <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: "inline-block" }} />
            {l.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180, borderBottom: "1px solid var(--color-divider)" }}>
        {buckets.map((b) => {
          const total = b.hadir + b.izin + b.alpha + b.libur;
          return (
            <div key={b.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: "100%", maxWidth: 36, display: "flex", flexDirection: "column-reverse", height: 160, borderRadius: "4px 4px 0 0", overflow: "hidden" }}>
                {LEGEND.map((l) => {
                  const count = b[l.key];
                  if (count === 0) return null;
                  return <div key={l.key} style={{ height: (count / maxTotal) * 160, background: l.color }} title={`${l.label}: ${count}`} />;
                })}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6, whiteSpace: "nowrap" }}>{b.label}</div>
              <div style={{ fontSize: 10, opacity: 0.4 }}>{total > 0 ? total : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LaporanKehadiranTabs({ records, employees }: { records: AttendanceRow[]; employees: Emp[] }) {
  const [mode, setMode] = useState<"bulanan" | "tahunan">("bulanan");
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const set = new Set<number>([currentYear]);
    for (const r of records) set.add(r.date.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [records, currentYear]);
  const [year, setYear] = useState(currentYear);
  const [q, setQ] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [sortWorst, setSortWorst] = useState(false);
  const siteOptions = useMemo(() => [...new Set(employees.map((e) => e.site.name))].sort(), [employees]);
  const positionOptions = useMemo(() => [...new Set(employees.map((e) => e.position.name))].sort(), [employees]);

  const buckets = mode === "bulanan" ? monthlyAttendanceBuckets(records, year) : yearlyAttendanceBuckets(records);

  const needle = q.trim().toLowerCase();
  const summary = useMemo(() => {
    const rows = employeeAttendanceSummary(employees, records, year);
    const filtered = rows.filter((r) => {
      if (siteFilter && r.siteName !== siteFilter) return false;
      if (positionFilter && r.positionName !== positionFilter) return false;
      if (needle && ![r.name, r.siteName].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortWorst) {
        const ratioA = a.total > 0 ? a.hadir / a.total : 1;
        const ratioB = b.total > 0 ? b.hadir / b.total : 1;
        return ratioA - ratioB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [employees, records, year, needle, sortWorst, siteFilter, positionFilter]);
  const { paged, page, setPage, totalItems } = usePagedRows(summary);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="seg" role="radiogroup" style={{ width: "fit-content" }}>
            <label className="seg-opt"><input type="radio" checked={mode === "bulanan"} onChange={() => setMode("bulanan")} /> Bulanan</label>
            <label className="seg-opt"><input type="radio" checked={mode === "tahunan"} onChange={() => setMode("tahunan")} /> Tahunan</label>
          </div>
          {mode === "bulanan" && (
            <div className="field" style={{ maxWidth: 140, marginBottom: 0 }}>
              <label htmlFor="laporan-year">Tahun</label>
              <select className="input" id="laporan-year" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <input
            type="text"
            className="input"
            placeholder="Cari nama, tempat kerja..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%", maxWidth: 220 }}
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
      </div>

      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <div className="card-kicker" style={{ marginBottom: "var(--space-3)" }}>
          {mode === "bulanan" ? `Tren kehadiran ${year}` : "Tren kehadiran per tahun"}
        </div>
        {buckets.every((b) => b.hadir + b.izin + b.alpha + b.libur === 0) ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada data kehadiran.</p>
        ) : (
          <BarChart buckets={buckets} />
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div className="card-kicker">Performa per karyawan &mdash; {year}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={sortWorst} onChange={(e) => setSortWorst(e.target.checked)} />
            Urutkan: terburuk dulu
          </label>
        </div>
        {summary.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>{employees.length === 0 ? "Belum ada karyawan." : "Tidak ada hasil."}</p>
        ) : (
          <>
          <table className="table">
            <thead><tr><th>Nama</th><th>Tempat kerja</th><th>Posisi</th><th>Hadir</th><th>Izin</th><th>Alpha</th><th>Total hari kerja</th></tr></thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.employeeId}>
                  <td>{r.name}</td>
                  <td className="text-muted">{r.siteName}</td>
                  <td className="text-muted">{r.positionName}</td>
                  <td>{r.hadir}</td>
                  <td>{r.izin}</td>
                  <td>{r.alpha}</td>
                  <td className="text-muted">{r.total}</td>
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
