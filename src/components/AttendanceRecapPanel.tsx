"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { fetchAttendanceRecap, upsertAttendanceDay } from "@/app/(app)/absensi/actions";
import {
  bestAttendanceMonth, bestPayrollPeriod, formatRp, monthlyAttendanceTally,
  payrollAttendanceTally, payrollPeriodKey, payrollPeriodOptions, payrollPeriodRange,
} from "@/lib/payroll";
import { monthKey, monthKeyOptions } from "@/lib/finance";
import { downloadXlsx } from "@/lib/xlsx-writer";

type RecapRow = {
  id: string;
  date: Date;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  location: string | null;
  scheduledCheckIn: string | null;
  scheduledCheckOut: string | null;
  lateMin: number;
};

function formatLate(min: number) {
  if (min <= 0) return "-";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}
type Payroll = { gajiPokok: number; potonganAbsensi: number; presentDays: number; leaveDays: number; workDays: number };
type Recap = { records: RecapRow[]; payroll: Payroll };

function toDateInputValue(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// "Bulan" (period) picks which month's rows are shown, but the quick-add
// "Tanggal" field defaulted to today's real calendar date regardless — so
// looking at, say, July while today is September left the date picker
// silently pointing at September, ready to add/correct the wrong month's
// day unless the user noticed and changed it by hand.
//
// In "payroll" mode the period itself isn't a calendar month either — it's
// the 21st–20th cycle payroll actually runs on — so the quick-add date has
// to default to that range's real start date, not the 1st.
function firstDayOfPeriod(period: string, mode: "calendar" | "payroll"): string {
  if (mode === "payroll") return toDateInputValue(payrollPeriodRange(period).start);
  const [y, m] = period.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

// The quick-add date used to accept literally any date regardless of the
// "Bulan"/period selected above it — so a correction meant for the period
// on screen could silently land in some other period instead (and vice
// versa: after typing/picking a date outside the range, nothing stopped
// you). Constraining it to the selected period's own bounds means the only
// way to correct a different period's day is to switch "Bulan" first,
// which is also what makes the date field re-point at that period.
function periodBounds(period: string, mode: "calendar" | "payroll"): { min: string; max: string } {
  if (mode === "payroll") {
    const { start, end } = payrollPeriodRange(period);
    return { min: toDateInputValue(start), max: toDateInputValue(end) };
  }
  const [y, m] = period.split("-").map(Number);
  return { min: `${y}-${String(m).padStart(2, "0")}-01`, max: toDateInputValue(new Date(y, m, 0)) };
}

// Isi rekap absensi murni (tanpa dialog/tombol sendiri) — dipakai oleh
// RecapDialog (wrapper tombol + dialog terpisah, untuk halaman Absensi, yang
// tetap pakai bulan kalender biasa) maupun langsung ditempel sebagai tab di
// PayrollDetailDialog (mode="payroll", cut off tanggal 21–20 sama seperti
// perhitungan gaji sesungguhnya, bukan bulan kalender yang beda tanggal
// tutupnya — kalau tidak, potongan absensi yang ditampilkan di sini bisa
// tidak nyambung dengan yang benar-benar dipotong dari gaji). Menempelnya
// langsung menghindari dialog-di-dalam-dialog yang bikin tampilan numpuk.
export function AttendanceRecapPanel({
  employeeId, employeeName, mode = "calendar", initialPeriod,
}: { employeeId: string; employeeName: string; mode?: "calendar" | "payroll"; initialPeriod?: string }) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(() => toDateInputValue(new Date()));
  const [newStatus, setNewStatus] = useState("Hadir");
  const [period, setPeriod] = useState(() => initialPeriod ?? (mode === "payroll" ? payrollPeriodKey(new Date()) : monthKey(new Date())));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchAttendanceRecap(employeeId);
      setRecap(data);
      // PayrollDetailDialog already knows exactly which period it's showing
      // gaji for — use that directly instead of guessing, so the recap
      // always matches the period the dialog was opened for.
      if (initialPeriod) {
        setPeriod(initialPeriod);
        setNewDate(firstDayOfPeriod(initialPeriod, mode));
        return;
      }
      // Otherwise default to whichever period actually has records — right
      // after an import, that's virtually never "today's real period".
      const best = mode === "payroll" ? bestPayrollPeriod(data.records) : bestAttendanceMonth(data.records);
      if (best) {
        setPeriod(best);
        setNewDate(firstDayOfPeriod(best, mode));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  function correctDay(dateIso: string, status: string) {
    setSavingDate(dateIso);
    startTransition(async () => {
      const data = await upsertAttendanceDay(employeeId, dateIso, status);
      setRecap(data);
      setSavingDate(null);
    });
  }

  const monthRecords = useMemo(
    () => (recap ? recap.records.filter((r) => (mode === "payroll" ? payrollPeriodKey(r.date) : monthKey(r.date)) === period) : []),
    [recap, period, mode],
  );

  // Prorate gaji pokok for the selected period specifically, using that
  // period's own day records — rather than the employee's live aggregate,
  // which always reflects whichever period currently has the most records.
  const monthPayroll = useMemo(() => {
    const tally = mode === "payroll"
      ? payrollAttendanceTally(recap?.records ?? [], period)
      : monthlyAttendanceTally(recap?.records ?? [], period);
    const gajiPokok = recap?.payroll.gajiPokok ?? 0;
    const paidDays = tally.presentDays + tally.leaveDays;
    const effective = tally.workDays > 0 ? Math.round((gajiPokok * paidDays) / tally.workDays) : gajiPokok;
    return { presentDays: tally.presentDays, workDays: tally.workDays, gajiPokok, potonganAbsensi: gajiPokok - effective };
  }, [recap, period, mode]);

  function download() {
    if (!recap) return;
    downloadXlsx(
      `absensi-${employeeName.replace(/\s+/g, "-").toLowerCase()}-${period}.xlsx`,
      [
        ["No", "Tanggal", "Status", "Masuk Seharusnya", "Keluar Seharusnya", "Masuk", "Keluar", "Terlambat", "Lokasi"],
        ...monthRecords.map((r, i) => [
          i + 1,
          r.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
          r.status,
          r.scheduledCheckIn ?? "-",
          r.scheduledCheckOut ?? "-",
          r.checkIn ?? "-",
          r.checkOut ?? "-",
          formatLate(r.lateMin),
          r.location ?? "-",
        ]),
      ],
    );
  }

  if (pending && !recap) return <p>Memuat&hellip;</p>;
  if (!recap) return null;

  const bounds = periodBounds(period, mode);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <div className="field" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label htmlFor="rec-period">Bulan</label>
          <select className="input" id="rec-period" value={period} onChange={(e) => { setPeriod(e.target.value); setNewDate(firstDayOfPeriod(e.target.value, mode)); }}>
            {(mode === "payroll" ? payrollPeriodOptions() : monthKeyOptions()).map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={download} disabled={monthRecords.length === 0}>
          Unduh Excel
        </button>
      </div>

      <div
        className="card grid-cols"
        style={{ marginBottom: "var(--space-3)", padding: "var(--space-3)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}
      >
        <div>
          <div className="card-kicker" style={{ fontSize: 11 }}>Hadir {mode === "payroll" ? "periode ini" : "bulan ini"}</div>
          <div style={{ fontWeight: 600 }}>{monthPayroll.presentDays}/{monthPayroll.workDays} hari</div>
        </div>
        <div>
          <div className="card-kicker" style={{ fontSize: 11 }}>Gaji pokok</div>
          <div style={{ fontWeight: 600 }}>{formatRp(monthPayroll.gajiPokok)}</div>
        </div>
        <div>
          <div className="card-kicker" style={{ fontSize: 11 }}>Potongan absensi</div>
          <div style={{ fontWeight: 600, color: monthPayroll.potonganAbsensi > 0 ? "var(--color-neutral-900)" : undefined }}>
            -{formatRp(monthPayroll.potonganAbsensi)}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0 }}>
        Gaji diprorata sesuai hari hadir/izin dibanding total hari kerja pada {mode === "payroll" ? "periode gaji (21–20) yang dipilih" : "bulan yang dipilih"} — mengoreksi status di bawah otomatis memperbarui potongan ini.
      </p>

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="rec-date">Tanggal</label>
          <input
            className="input" id="rec-date" type="date" value={newDate}
            min={bounds.min} max={bounds.max}
            onChange={(e) => {
              const v = e.target.value;
              setNewDate(v < bounds.min ? bounds.min : v > bounds.max ? bounds.max : v);
            }}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="rec-status">Status</label>
          <select className="input" id="rec-status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="Hadir">Hadir</option>
            <option value="Izin">Izin</option>
            <option value="Alpha">Alpha</option>
            <option value="Hari Libur">Hari Libur</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => correctDay(newDate, newStatus)}>
          Tambah / koreksi
        </button>
      </div>

      {monthRecords.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada catatan harian untuk {mode === "payroll" ? "periode ini" : "bulan ini"}.</p>
      ) : (
        <table className="table table-nested">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Masuk seharusnya</th>
              <th>Keluar seharusnya</th>
              <th>Masuk</th>
              <th>Keluar</th>
              <th>Terlambat</th>
              <th>Lokasi</th>
            </tr>
          </thead>
          <tbody>
            {monthRecords.map((r, i) => {
              const dateIso = toDateInputValue(r.date);
              return (
                <tr key={r.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td>{r.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
                  <td>
                    <select
                      className="input"
                      style={{ minHeight: 28, fontSize: 12, minWidth: 110 }}
                      value={r.status}
                      disabled={pending && savingDate === dateIso}
                      onChange={(e) => correctDay(dateIso, e.target.value)}
                    >
                      <option value="Hadir">Hadir</option>
                      <option value="Izin">Izin</option>
                      <option value="Alpha">Alpha</option>
                      <option value="Hari Libur">Hari Libur</option>
                    </select>
                  </td>
                  <td className="text-muted">{r.scheduledCheckIn ?? "-"}</td>
                  <td className="text-muted">{r.scheduledCheckOut ?? "-"}</td>
                  <td className="text-muted">{r.checkIn ?? "-"}</td>
                  <td className="text-muted">{r.checkOut ?? "-"}</td>
                  <td>
                    {r.lateMin > 0 ? (
                      <span className="tag tag-outline">{formatLate(r.lateMin)}</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{r.location ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
