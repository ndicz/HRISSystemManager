"use client";

import { useState } from "react";
import type { PayrollEntry, OvertimeDay } from "@prisma/client";
import { formatRp, computeMonthlyPayroll } from "@/lib/payroll";
import { updateBpjsOverride } from "@/app/(app)/penggajian/actions";
import { PayrollEntryPanel } from "@/components/PayrollEntryPanel";
import { AttendanceRecapPanel } from "@/components/AttendanceRecapPanel";
import { PayGajiButton } from "@/components/PayGajiButton";

type Payroll = ReturnType<typeof computeMonthlyPayroll>;
type Tab = "ringkasan" | "lembur" | "absensi";

// Everything that used to be spread across ~15 columns in the Gaji Bulanan
// table, consolidated into ONE dialog with internal tabs — full breakdown,
// BPJS edit, lembur/potongan overrides, attendance recap, and payment.
// Lembur & Rekap dulu masing-masing dialog TERPISAH yang dibuka dari sini,
// menghasilkan dialog-di-dalam-dialog yang numpuk; sekarang isinya
// ditempel langsung sebagai tab di dialog yang sama.
export function PayrollDetailDialog({
  employeeId,
  employeeName,
  period,
  p,
  entry,
  overtimeDays,
  bpjsKesehatanOverride,
  bpjsKetenagakerjaanOverride,
}: {
  employeeId: string;
  employeeName: string;
  period: string;
  p: Payroll;
  entry: PayrollEntry | null;
  overtimeDays: OvertimeDay[];
  bpjsKesehatanOverride: number | null;
  bpjsKetenagakerjaanOverride: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [bpjsKes, setBpjsKes] = useState(bpjsKesehatanOverride?.toString() ?? "");
  const [bpjsTk, setBpjsTk] = useState(bpjsKetenagakerjaanOverride?.toString() ?? "");
  const [bpjsPending, setBpjsPending] = useState(false);
  const [bpjsError, setBpjsError] = useState("");
  const [bpjsSaved, setBpjsSaved] = useState(false);

  function saveBpjs() {
    setBpjsError("");
    setBpjsPending(true);
    setBpjsSaved(false);
    updateBpjsOverride(
      employeeId,
      bpjsKes.trim() ? Math.max(0, parseInt(bpjsKes, 10) || 0) : null,
      bpjsTk.trim() ? Math.max(0, parseInt(bpjsTk, 10) || 0) : null,
    )
      .then(() => setBpjsSaved(true))
      .catch((err) => setBpjsError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBpjsPending(false));
  }

  function close() {
    setOpen(false);
    setTab("ringkasan");
  }

  const rows: [string, number][] = p.usesFlatRate
    ? [
        ["Gaji pokok", p.gajiPokok],
        ["Potongan izin", -p.potonganIzin],
        ["Potongan alfa", -p.potonganAlpha],
        ["Potongan terlambat", -p.potonganTerlambat],
        ["Lembur reguler", p.lemburReguler],
        ["Lembur merah", p.lemburMerah],
        ["Allowance", p.allowance],
      ]
    : [
        ["Gaji pokok", p.gajiPokok],
        ["Potongan absensi", -p.potonganAbsensi],
        ["Lembur", p.lembur],
      ];

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Detail
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 760, width: "94vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Detail Gaji &mdash; {employeeName}</div>

            <div className="seg" role="radiogroup" style={{ width: "fit-content", marginBottom: "var(--space-4)" }}>
              <label className="seg-opt"><input type="radio" checked={tab === "ringkasan"} onChange={() => setTab("ringkasan")} /> Ringkasan</label>
              <label className="seg-opt"><input type="radio" checked={tab === "lembur"} onChange={() => setTab("lembur")} /> Lembur &amp; Potongan</label>
              <label className="seg-opt"><input type="radio" checked={tab === "absensi"} onChange={() => setTab("absensi")} /> Rekap Absensi</label>
            </div>

            <div className="dialog-body" style={{ maxHeight: "62vh", overflowY: "auto" }}>
              {tab === "ringkasan" && (
                <>
                  <table className="table" style={{ marginBottom: "var(--space-4)" }}>
                    <thead><tr><th>Komponen</th><th>Jumlah</th></tr></thead>
                    <tbody>
                      {rows.map(([label, amount]) => (
                        <tr key={label}><td>{label}</td><td>{formatRp(amount)}</td></tr>
                      ))}
                      <tr><td>Penugasan tambahan</td><td>{formatRp(p.penugasanTambahan)}</td></tr>
                      <tr><td>Potongan BPJS Kesehatan</td><td>-{formatRp(p.bpjsKesehatan)}</td></tr>
                      <tr><td>Potongan BPJS Ketenagakerjaan</td><td>-{formatRp(p.bpjsKetenagakerjaan)}</td></tr>
                      <tr><td>Potongan kasbon</td><td>-{formatRp(p.kasbonBulanIni)}</td></tr>
                      <tr style={{ fontWeight: 700 }}><td>Total diterima</td><td>{formatRp(p.total)}</td></tr>
                    </tbody>
                  </table>

                  <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                    <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Potongan BPJS (kosongkan = pakai rumus otomatis)</div>
                    <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "var(--space-3)", alignItems: "end" }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="detail-bpjs-kes">BPJS Kesehatan (Rp)</label>
                        <input className="input" id="detail-bpjs-kes" type="number" min={0} placeholder="Otomatis" value={bpjsKes} onChange={(e) => { setBpjsKes(e.target.value); setBpjsSaved(false); }} />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="detail-bpjs-tk">BPJS Ketenagakerjaan (Rp)</label>
                        <input className="input" id="detail-bpjs-tk" type="number" min={0} placeholder="Otomatis" value={bpjsTk} onChange={(e) => { setBpjsTk(e.target.value); setBpjsSaved(false); }} />
                      </div>
                      <button type="button" className="btn btn-secondary" disabled={bpjsPending} onClick={saveBpjs}>
                        {bpjsPending ? "Menyimpan…" : "Simpan"}
                      </button>
                    </div>
                    {bpjsError && <p style={{ fontSize: 13, color: "var(--color-accent-800)", marginTop: 8, marginBottom: 0 }}>{bpjsError}</p>}
                    {bpjsSaved && !bpjsPending && <p style={{ fontSize: 12, color: "var(--color-accent)", marginTop: 8, marginBottom: 0 }}>Tersimpan.</p>}
                  </div>
                </>
              )}

              {tab === "lembur" && (
                <PayrollEntryPanel employeeId={employeeId} period={period} entry={entry} overtimeDays={overtimeDays} />
              )}

              {tab === "absensi" && (
                <AttendanceRecapPanel employeeId={employeeId} employeeName={employeeName} />
              )}
            </div>

            <div className="dialog-actions">
              {entry?.paid ? (
                <span className="tag tag-accent" style={{ marginRight: "auto" }}>✓ Sudah dibayar</span>
              ) : (
                <PayGajiButton employeeIds={[employeeId]} period={period} totalAmount={p.total} label="Bayar gaji" />
              )}
              <a href={`/print/slip/${employeeId}?period=${period}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Cetak slip
              </a>
              <button type="button" className="btn btn-secondary" onClick={close}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
