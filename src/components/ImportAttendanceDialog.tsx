"use client";

import { useRef, useState, useTransition } from "react";
import { parseAttendanceImport, applyAttendanceImport } from "@/app/(app)/absensi/actions";
import type { AttendanceImportResult } from "@/lib/attendanceImport";

type Status = "idle" | "parsing" | "error" | "done" | "applying" | "applied";

export function ImportAttendanceDialog({ sites }: { sites: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  // Separate from `error`/"error" status: a failed apply shouldn't throw
  // away the already-parsed review table and send the user back to
  // re-upload the file — they usually just need to fix the site picker.
  const [applyError, setApplyError] = useState("");
  const [result, setResult] = useState<AttendanceImportResult | null>(null);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [applySummary, setApplySummary] = useState<{ created: number; updated: number; daysRecorded: number } | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStatus("idle");
    setError("");
    setApplyError("");
    setResult(null);
    setApplySummary(null);
  }

  function close() {
    setOpen(false);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("file", file);
        const parsed = await parseAttendanceImport(fd);
        setResult(parsed);
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    });
  }

  function handleApply() {
    if (!result) return;
    setStatus("applying");
    setApplyError("");
    startTransition(async () => {
      try {
        const res = await applyAttendanceImport(result.rows, siteId);
        setApplySummary(res);
        setStatus("applied");
      } catch (err) {
        setApplyError(err instanceof Error ? err.message : String(err));
        setStatus("done");
      }
    });
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Import dari mesin fingerprint
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 720, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Import rekap absensi (Excel)</div>
            <div className="dialog-body" style={{ maxHeight: "56vh", overflowY: "auto" }}>
              {status === "idle" && (
                <>
                  <p style={{ marginTop: 0 }}>
                    Unggah file rekap absensi vertikal (format .xlsx, kolom No/Date/Status/Clock In/Clock Out/&hellip;) — seperti export dari aplikasi absensi mesin fingerprint.
                  </p>
                  <div className="field">
                    <label htmlFor="imp-file">File Excel</label>
                    <input ref={fileInputRef} className="input" id="imp-file" type="file" accept=".xlsx" onChange={handleFile} />
                  </div>
                </>
              )}
              {status === "parsing" && <p>Memproses file&hellip;</p>}
              {status === "error" && (
                <>
                  <p style={{ color: "var(--color-accent-800)" }}>Gagal membaca file: {error}</p>
                  <div className="field">
                    <label htmlFor="imp-file2">Coba file lain</label>
                    <input className="input" id="imp-file2" type="file" accept=".xlsx" onChange={handleFile} />
                  </div>
                </>
              )}
              {(status === "done" || status === "applying") && result && (
                <>
                  <p style={{ marginTop: 0 }}>
                    {result.summary.companyName} &middot; {result.summary.period} &middot; {result.summary.count} personil terbaca
                  </p>
                  <div className="field" style={{ maxWidth: 280 }}>
                    <label htmlFor="imp-site">Tempat kerja untuk personil baru</label>
                    {sites.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--color-accent-800)", margin: "4px 0 0" }}>
                        Belum ada tempat kerja — tambahkan dulu di bagian &ldquo;Tempat Kerja&rdquo; pada halaman ini sebelum menerapkan.
                      </p>
                    ) : (
                      <select className="input" id="imp-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <table className="table">
                    <thead><tr><th>Nama</th><th>Kode</th><th>Hadir</th><th>Sakit/Izin</th><th>Alpha</th><th>Libur</th></tr></thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td className="text-muted">{row.code}</td>
                          <td>{row.hadir}</td>
                          <td>{row.sakit}</td>
                          <td>{row.alpha}</td>
                          <td>{row.libur}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 0 }}>
                    Menerapkan akan menambahkan personil yang belum ada ke data karyawan dan memperbarui status kehadiran personil yang cocok (dicocokkan berdasarkan nama).
                  </p>
                  {applyError && (
                    <p style={{ fontSize: 13, color: "var(--color-accent-800)", marginBottom: 0 }}>Gagal menerapkan: {applyError}</p>
                  )}
                </>
              )}
              {status === "applied" && applySummary && (
                <p style={{ marginTop: 0 }}>
                  Berhasil diterapkan — {applySummary.updated} karyawan diperbarui, {applySummary.created} karyawan baru ditambahkan, {applySummary.daysRecorded} catatan harian tersimpan. Lihat detail per hari lewat tombol &ldquo;Rekap bulanan&rdquo; di tabel absensi.
                </p>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close}>
                Tutup
              </button>
              {status !== "applied" && (
                <button type="button" className="btn btn-primary" onClick={handleApply} disabled={status !== "done" || sites.length === 0}>
                  {status === "applying" ? "Menerapkan…" : "Terapkan ke data karyawan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
