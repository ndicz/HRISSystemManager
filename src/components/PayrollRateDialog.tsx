"use client";

import { useState } from "react";
import type { PayrollRate } from "@prisma/client";
import { savePayrollRate, deletePayrollRate } from "@/app/(app)/penggajian/actions";

type Site = { id: string; name: string };

export function PayrollRateDialog({ period, sites, rates }: { period: string; sites: Site[]; rates: PayrollRate[] }) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  const current = rates.find((r) => r.period === period && r.siteId === (siteId || null)) ?? null;

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await savePayrollRate(formData);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!current) return;
    if (!window.confirm("Hapus tarif ini? Periode/tempat kerja ini akan kembali pakai potongan proporsional otomatis.")) return;
    setDelError("");
    setDelPending(true);
    deletePayrollRate(period, siteId || null)
      .then(() => setOpen(false))
      .catch((err) => setDelError(err instanceof Error ? err.message : String(err)))
      .finally(() => setDelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Atur tarif potongan &amp; lembur
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tarif Potongan &amp; Lembur &mdash; {period}</div>
            <p style={{ fontSize: 12.5, opacity: 0.65, marginTop: -4, marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
              Tarif di sini berlaku otomatis untuk <strong>semua karyawan</strong> pada tempat kerja yang dipilih. Untuk satu
              karyawan yang rate-nya memang beda, lebih mudah diisi manual lewat tombol &ldquo;Detail&rdquo; di baris karyawan
              itu pada tabel Gaji Bulanan — angka manual itu akan menggantikan tarif di sini khusus untuk orang tersebut.
            </p>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-4)" }} key={siteId + current?.id}>
              <input type="hidden" name="period" value={period} />
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="rate-site">Berlaku untuk</label>
                <select className="input" id="rate-site" name="siteId" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  <option value="">Semua tempat kerja (tarif default)</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>Khusus: {s.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: 12, opacity: 0.6, margin: "4px 0 0" }}>
                  {siteId
                    ? "Tarif khusus ini menggantikan tarif default untuk tempat kerja ini saja."
                    : "Atur ini dulu sebagai tarif dasar — baru buat pengecualian per tempat kerja bila perlu."}
                </p>
              </div>

              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Potongan per hari kejadian (Rp)</div>
                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="izinRate">Izin</label>
                    <input className="input" id="izinRate" name="izinRate" type="number" min={0} defaultValue={current?.izinRate ?? 0} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="alphaRate">Alfa</label>
                    <input className="input" id="alphaRate" name="alphaRate" type="number" min={0} defaultValue={current?.alphaRate ?? 0} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="terlambatRate">Terlambat</label>
                    <input className="input" id="terlambatRate" name="terlambatRate" type="number" min={0} defaultValue={current?.terlambatRate ?? 0} />
                  </div>
                </div>
              </div>

              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)" }}>
                <div className="card-kicker" style={{ marginBottom: "var(--space-2)" }}>Lembur per hari (Rp)</div>
                <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="lemburRegulerRate">Reguler</label>
                    <input className="input" id="lemburRegulerRate" name="lemburRegulerRate" type="number" min={0} defaultValue={current?.lemburRegulerRate ?? 0} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="lemburMerahRate">Tanggal merah</label>
                    <input className="input" id="lemburMerahRate" name="lemburMerahRate" type="number" min={0} defaultValue={current?.lemburMerahRate ?? 0} />
                  </div>
                </div>
              </div>

              {delError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{delError}</p>}
              <div className="dialog-actions">
                {current && (
                  <button type="button" className="btn btn-ghost" disabled={delPending} onClick={handleDelete} style={{ marginRight: "auto" }}>
                    {delPending ? "Menghapus…" : "Hapus tarif ini"}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
