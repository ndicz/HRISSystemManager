"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PayrollEntry, OvertimeDay } from "@prisma/client";
import { formatRp, computeMonthlyPayroll } from "@/lib/payroll";
import { updateBpjsOverride, updatePayrollAmounts } from "@/app/(app)/penggajian/actions";
import { PayrollEntryPanel } from "@/components/PayrollEntryPanel";
import { AttendanceRecapPanel } from "@/components/AttendanceRecapPanel";
import { PayGajiButton } from "@/components/PayGajiButton";
import { RupiahInput } from "@/components/RupiahInput";
import { BASE_PATH } from "@/lib/basePath";
import { formatActionError } from "@/lib/errors";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [bpjsKes, setBpjsKes] = useState(bpjsKesehatanOverride ?? 0);
  const [bpjsTk, setBpjsTk] = useState(bpjsKetenagakerjaanOverride ?? 0);
  const [bpjsPending, setBpjsPending] = useState(false);
  const [bpjsError, setBpjsError] = useState("");
  const [bpjsSaved, setBpjsSaved] = useState(false);

  function saveBpjs() {
    setBpjsError("");
    setBpjsPending(true);
    setBpjsSaved(false);
    updateBpjsOverride(employeeId, bpjsKes > 0 ? bpjsKes : null, bpjsTk > 0 ? bpjsTk : null)
      .then(() => {
        setBpjsSaved(true);
        router.refresh();
      })
      .catch((err) => setBpjsError(formatActionError(err)))
      .finally(() => setBpjsPending(false));
  }

  // Direct inline edits for the four amounts that had no override anywhere
  // else (gaji pokok, potongan absensi, penugasan tambahan, kasbon) — same
  // null-means-auto convention as BPJS above, but saved separately since
  // this form's fields don't overlap with either the BPJS box or the
  // "Lembur & Potongan" tab's own overrides. 0 doubles as "no override" the
  // same way RupiahInput itself treats a blank field as 0.
  const [gajiPokok, setGajiPokok] = useState(entry?.gajiPokokOverride ?? 0);
  const [potonganAbsensi, setPotonganAbsensi] = useState(entry?.potonganAbsensiOverride ?? 0);
  const [penugasanTambahan, setPenugasanTambahan] = useState(entry?.penugasanTambahanOverride ?? 0);
  const [kasbon, setKasbon] = useState(entry?.kasbonOverride ?? 0);
  const [amountsPending, setAmountsPending] = useState(false);
  const [amountsError, setAmountsError] = useState("");
  const [amountsSaved, setAmountsSaved] = useState(false);

  function toOverride(v: number): number | null {
    return v > 0 ? v : null;
  }

  function saveAmounts() {
    setAmountsError("");
    setAmountsPending(true);
    setAmountsSaved(false);
    updatePayrollAmounts(employeeId, period, {
      gajiPokokOverride: toOverride(gajiPokok),
      potonganAbsensiOverride: toOverride(potonganAbsensi),
      penugasanTambahanOverride: toOverride(penugasanTambahan),
      kasbonOverride: toOverride(kasbon),
    })
      .then(() => {
        setAmountsSaved(true);
        router.refresh();
      })
      .catch((err) => setAmountsError(formatActionError(err)))
      .finally(() => setAmountsPending(false));
  }

  function close() {
    setOpen(false);
    setTab("ringkasan");
  }

  type Row = { key: string; label: string; amount: number; editable?: { value: number; onChange: (v: number) => void } };

  const gajiPokokEdit = { value: gajiPokok, onChange: (v: number) => { setGajiPokok(v); setAmountsSaved(false); } };
  const potonganAbsensiEdit = { value: potonganAbsensi, onChange: (v: number) => { setPotonganAbsensi(v); setAmountsSaved(false); } };
  const penugasanTambahanEdit = { value: penugasanTambahan, onChange: (v: number) => { setPenugasanTambahan(v); setAmountsSaved(false); } };
  const kasbonEdit = { value: kasbon, onChange: (v: number) => { setKasbon(v); setAmountsSaved(false); } };

  const rows: Row[] = p.usesFlatRate
    ? [
        { key: "gajiPokok", label: "Gaji pokok", amount: p.gajiPokok, editable: gajiPokokEdit },
        { key: "izin", label: "Potongan izin", amount: -p.potonganIzin },
        { key: "alfa", label: "Potongan alfa", amount: -p.potonganAlpha },
        { key: "terlambat", label: "Potongan terlambat", amount: -p.potonganTerlambat },
        { key: "lemburReguler", label: "Lembur reguler", amount: p.lemburReguler },
        { key: "lemburMerah", label: "Lembur merah", amount: p.lemburMerah },
        { key: "allowance", label: "Bonus", amount: p.allowance },
      ]
    : [
        { key: "gajiPokok", label: "Gaji pokok", amount: p.gajiPokok, editable: gajiPokokEdit },
        { key: "potonganAbsensi", label: "Potongan absensi", amount: -p.potonganAbsensi, editable: potonganAbsensiEdit },
        { key: "lembur", label: "Lembur", amount: p.lembur },
        { key: "allowance", label: "Bonus", amount: p.allowance },
      ];
  rows.push(
    { key: "penugasan", label: "Penugasan tambahan", amount: p.penugasanTambahan, editable: penugasanTambahanEdit },
    { key: "bpjsKes", label: "Potongan BPJS Kesehatan", amount: -p.bpjsKesehatan },
    { key: "bpjsTk", label: "Potongan BPJS Ketenagakerjaan", amount: -p.bpjsKetenagakerjaan },
    { key: "kasbon", label: "Potongan kasbon", amount: -p.kasbonBulanIni, editable: kasbonEdit },
  );

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
                  <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0, marginBottom: "var(--space-2)" }}>Kolom yang bisa diedit: kosongkan = pakai jumlah otomatis (ditampilkan sebagai placeholder).</p>
                  <table className="table table-nested" style={{ marginBottom: "var(--space-2)" }}>
                    <thead><tr><th>Komponen</th><th>Jumlah</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.label}</td>
                          <td>
                            {r.editable ? (
                              <RupiahInput
                                name={r.key}
                                defaultValue={r.editable.value}
                                placeholder={formatRp(Math.abs(r.amount))}
                                onValueChange={r.editable.onChange}
                                style={{ maxWidth: 180, minHeight: 30, fontSize: 13 }}
                              />
                            ) : formatRp(r.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700 }}><td>Total diterima</td><td>{formatRp(p.total)}</td></tr>
                    </tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                    {amountsError && <span style={{ fontSize: 12, color: "var(--color-danger)" }}>{amountsError}</span>}
                    {amountsSaved && !amountsPending && <span style={{ fontSize: 12, color: "var(--color-accent)" }}>Tersimpan.</span>}
                    <button type="button" className="btn btn-secondary" disabled={amountsPending} onClick={saveAmounts}>
                      {amountsPending ? "Menyimpan…" : "Simpan jumlah"}
                    </button>
                  </div>

                  <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                    <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Potongan BPJS (kosongkan = pakai rumus otomatis)</div>
                    <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "var(--space-3)", alignItems: "end" }}>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="detail-bpjs-kes">BPJS Kesehatan (Rp)</label>
                        <RupiahInput id="detail-bpjs-kes" name="bpjsKes" defaultValue={bpjsKes} placeholder="Otomatis" onValueChange={(v) => { setBpjsKes(v); setBpjsSaved(false); }} />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="detail-bpjs-tk">BPJS Ketenagakerjaan (Rp)</label>
                        <RupiahInput id="detail-bpjs-tk" name="bpjsTk" defaultValue={bpjsTk} placeholder="Otomatis" onValueChange={(v) => { setBpjsTk(v); setBpjsSaved(false); }} />
                      </div>
                      <button type="button" className="btn btn-secondary" disabled={bpjsPending} onClick={saveBpjs}>
                        {bpjsPending ? "Menyimpan…" : "Simpan"}
                      </button>
                    </div>
                    {bpjsError && <p style={{ fontSize: 13, color: "var(--color-danger)", marginTop: 8, marginBottom: 0 }}>{bpjsError}</p>}
                    {bpjsSaved && !bpjsPending && <p style={{ fontSize: 12, color: "var(--color-accent)", marginTop: 8, marginBottom: 0 }}>Tersimpan.</p>}
                  </div>
                </>
              )}

              {tab === "lembur" && (
                <PayrollEntryPanel employeeId={employeeId} period={period} entry={entry} overtimeDays={overtimeDays} />
              )}

              {tab === "absensi" && (
                <AttendanceRecapPanel employeeId={employeeId} employeeName={employeeName} mode="payroll" initialPeriod={period} />
              )}
            </div>

            <div className="dialog-actions">
              {entry?.paid ? (
                <span className="tag tag-accent" style={{ marginRight: "auto" }}>✓ Sudah dibayar</span>
              ) : (
                <PayGajiButton employeeIds={[employeeId]} period={period} totalAmount={p.total} label="Bayar gaji" />
              )}
              {entry?.paid ? (
                <a href={`${BASE_PATH}/print/slip/${employeeId}?period=${period}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  Cetak slip
                </a>
              ) : (
                <button type="button" className="btn btn-secondary" disabled title="Bayar gaji dulu sebelum cetak slip">
                  Cetak slip
                </button>
              )}
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
