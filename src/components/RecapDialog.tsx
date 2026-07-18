"use client";

import { useState, useTransition } from "react";
import { fetchAttendanceRecap, upsertAttendanceDay } from "@/app/(app)/absensi/actions";
import { formatRp } from "@/lib/payroll";
import { downloadCsv } from "@/lib/csv";

type RecapRow = { id: string; date: Date; status: string; checkIn: string | null; checkOut: string | null; location: string | null };
type Payroll = { gajiPokok: number; potonganAbsensi: number; presentDays: number; leaveDays: number; workDays: number };
type Recap = { records: RecapRow[]; payroll: Payroll };

function toDateInputValue(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function RecapDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(() => toDateInputValue(new Date()));
  const [newStatus, setNewStatus] = useState("Hadir");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const data = await fetchAttendanceRecap(employeeId);
      setRecap(data);
    });
  }

  function openDialog() {
    setOpen(true);
    load();
  }

  function correctDay(dateIso: string, status: string) {
    setSavingDate(dateIso);
    startTransition(async () => {
      const data = await upsertAttendanceDay(employeeId, dateIso, status);
      setRecap(data);
      setSavingDate(null);
    });
  }

  function download() {
    if (!recap) return;
    downloadCsv(
      `absensi-${employeeName.replace(/\s+/g, "-").toLowerCase()}.csv`,
      [
        ["No", "Tanggal", "Status", "Masuk", "Keluar", "Lokasi"],
        ...recap.records.map((r, i) => [
          i + 1,
          r.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
          r.status,
          r.checkIn ?? "-",
          r.checkOut ?? "-",
          r.location ?? "-",
        ]),
      ],
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={openDialog}>
        Rekap bulanan
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ maxWidth: 680, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Rekap Absensi &mdash; {employeeName}</div>
            <div className="dialog-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {pending && !recap && <p>Memuat&hellip;</p>}

              {recap && (
                <>
                  <div
                    className="card"
                    style={{ marginBottom: "var(--space-3)", padding: "var(--space-3)", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-2)" }}
                  >
                    <div>
                      <div className="card-kicker" style={{ fontSize: 11 }}>Hadir bulan ini</div>
                      <div style={{ fontWeight: 600 }}>{recap.payroll.presentDays}/{recap.payroll.workDays} hari</div>
                    </div>
                    <div>
                      <div className="card-kicker" style={{ fontSize: 11 }}>Gaji pokok</div>
                      <div style={{ fontWeight: 600 }}>{formatRp(recap.payroll.gajiPokok)}</div>
                    </div>
                    <div>
                      <div className="card-kicker" style={{ fontSize: 11 }}>Potongan absensi</div>
                      <div style={{ fontWeight: 600, color: recap.payroll.potonganAbsensi > 0 ? "var(--color-neutral-900)" : undefined }}>
                        -{formatRp(recap.payroll.potonganAbsensi)}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0 }}>
                    Gaji diprorata sesuai hari hadir/izin dibanding total hari kerja bulan ini — mengoreksi status di bawah otomatis memperbarui potongan ini.
                  </p>

                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="rec-date">Tanggal</label>
                      <input className="input" id="rec-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
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

                  {recap.records.length === 0 ? (
                    <p style={{ fontSize: 13, opacity: 0.6 }}>Belum ada catatan harian untuk karyawan ini.</p>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Tanggal</th>
                          <th>Status</th>
                          <th>Masuk</th>
                          <th>Keluar</th>
                          <th>Lokasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recap.records.map((r, i) => {
                          const dateIso = toDateInputValue(r.date);
                          return (
                            <tr key={r.id}>
                              <td className="text-muted">{i + 1}</td>
                              <td>{r.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
                              <td>
                                <select
                                  className="input"
                                  style={{ minHeight: 28, fontSize: 12 }}
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
                              <td className="text-muted">{r.checkIn ?? "-"}</td>
                              <td className="text-muted">{r.checkOut ?? "-"}</td>
                              <td className="text-muted" style={{ fontSize: 12 }}>{r.location ?? "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Tutup
              </button>
              <button type="button" className="btn btn-primary" onClick={download} disabled={!recap || recap.records.length === 0}>
                Unduh CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
