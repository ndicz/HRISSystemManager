"use client";

import { useRef, useState, useTransition } from "react";
import { parseBpjsImport, applyBpjsImport } from "@/app/(app)/karyawan/actions";
import type { BpjsImportRow } from "@/lib/bpjsImport";

type Status = "idle" | "parsing" | "error" | "done" | "applying" | "applied";

export function ImportBpjsDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [rows, setRows] = useState<BpjsImportRow[] | null>(null);
  const [applySummary, setApplySummary] = useState<{ matched: number; unmatched: string[] } | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStatus("idle");
    setError("");
    setApplyError("");
    setRows(null);
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
        const parsed = await parseBpjsImport(fd);
        setRows(parsed);
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    });
  }

  function handleApply() {
    if (!rows) return;
    setStatus("applying");
    setApplyError("");
    startTransition(async () => {
      try {
        const res = await applyBpjsImport(rows);
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
        Import BPJS dari Excel
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 680, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Import BPJS Kesehatan &amp; Ketenagakerjaan</div>
            <div className="dialog-body" style={{ maxHeight: "56vh", overflowY: "auto" }}>
              {status === "idle" && (
                <>
                  <p style={{ marginTop: 0 }}>
                    Unggah file Excel dengan kolom ID Karyawan, BPJS Kesehatan, dan BPJS Ketenagakerjaan (Rp per bulan). Karyawan dicocokkan berdasarkan ID/kode karyawan.
                  </p>
                  <div className="field">
                    <label htmlFor="bpjs-file">File Excel</label>
                    <input ref={fileInputRef} className="input" id="bpjs-file" type="file" accept=".xlsx" onChange={handleFile} />
                  </div>
                </>
              )}
              {status === "parsing" && <p>Memproses file&hellip;</p>}
              {status === "error" && (
                <>
                  <p style={{ color: "var(--color-accent-800)" }}>Gagal membaca file: {error}</p>
                  <div className="field">
                    <label htmlFor="bpjs-file2">Coba file lain</label>
                    <input className="input" id="bpjs-file2" type="file" accept=".xlsx" onChange={handleFile} />
                  </div>
                </>
              )}
              {(status === "done" || status === "applying") && rows && (
                <>
                  <p style={{ marginTop: 0 }}>{rows.length} baris terbaca.</p>
                  <table className="table">
                    <thead><tr><th>ID</th><th>Nama</th><th>BPJS Kesehatan</th><th>BPJS Ketenagakerjaan</th></tr></thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td className="text-muted">{row.empCode}</td>
                          <td>{row.name ?? "-"}</td>
                          <td>{row.bpjsKesehatan !== null ? "Rp" + row.bpjsKesehatan.toLocaleString("id-ID") : "(kosong)"}</td>
                          <td>{row.bpjsKetenagakerjaan !== null ? "Rp" + row.bpjsKetenagakerjaan.toLocaleString("id-ID") : "(kosong)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 0 }}>
                    Menerapkan akan mengganti potongan BPJS manual (override) untuk setiap karyawan yang ID-nya cocok — termasuk nilai Rp0 jika memang tertulis 0 di file. Baris yang kosong (&ldquo;(kosong)&rdquo;) tidak diubah. ID yang tidak cocok dengan karyawan manapun akan dilewati dan ditampilkan setelah selesai.
                  </p>
                  {applyError && (
                    <p style={{ fontSize: 13, color: "var(--color-accent-800)", marginBottom: 0 }}>Gagal menerapkan: {applyError}</p>
                  )}
                </>
              )}
              {status === "applied" && applySummary && (
                <>
                  <p style={{ marginTop: 0 }}>
                    Berhasil diterapkan — {applySummary.matched} karyawan diperbarui.
                  </p>
                  {applySummary.unmatched.length > 0 && (
                    <p style={{ fontSize: 13, color: "var(--color-accent-800)" }}>
                      {applySummary.unmatched.length} ID tidak cocok dengan karyawan manapun: {applySummary.unmatched.join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close}>
                Tutup
              </button>
              {status !== "applied" && (
                <button type="button" className="btn btn-primary" onClick={handleApply} disabled={status !== "done"}>
                  {status === "applying" ? "Menerapkan…" : "Terapkan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
