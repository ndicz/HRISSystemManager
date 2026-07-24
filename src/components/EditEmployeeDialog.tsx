"use client";

import { useState, useRef } from "react";
import { updateEmployeeDetails, deleteEmployee } from "@/app/(app)/karyawan/actions";
import { formatRp, kasbonPerBulan } from "@/lib/payroll";

type Emp = {
  id: string;
  name: string;
  siteId: string;
  contractType: string;
  contractEnd: Date | null;
  kasbon: number;
  kasbonCicilan: number;
  cutiKuota: number;
  bpjsKesehatanOverride: number | null;
  bpjsKetenagakerjaanOverride: number | null;
};

type Site = { id: string; name: string };

function toDateInputValue(d: Date | null) {
  if (!d) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function EditEmployeeDialog({ employee, sites }: { employee: Emp; sites: Site[] }) {
  const [open, setOpen] = useState(false);
  const [contractType, setContractType] = useState(employee.contractType);
  const [kasbon, setKasbon] = useState(employee.kasbon);
  const [kasbonCicilan, setKasbonCicilan] = useState(employee.kasbonCicilan || 1);
  const [pending, setPending] = useState(false);
  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await updateEmployeeDetails(formData);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Hapus data karyawan "${employee.name}" secara permanen? Hanya bisa jika belum ada riwayat absensi/gaji. Aksi ini tidak bisa dibatalkan.`)) return;
    setDelError("");
    setDelPending(true);
    deleteEmployee(employee.id)
      .then(() => setOpen(false))
      .catch((err) => setDelError(err instanceof Error ? err.message : String(err)))
      .finally(() => setDelPending(false));
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit karyawan &mdash; {employee.name}</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <input type="hidden" name="employeeId" value={employee.id} />
              <div className="field">
                <label htmlFor="siteId">Tempat kerja</label>
                <select className="input" id="siteId" name="siteId" defaultValue={employee.siteId}>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Jenis kontrak</label>
                <div className="seg" role="radiogroup">
                  <label className="seg-opt">
                    <input type="radio" name="contractType" value="PKWT" checked={contractType === "PKWT"} onChange={() => setContractType("PKWT")} />
                    PKWT
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="contractType" value="PKWTT" checked={contractType === "PKWTT"} onChange={() => setContractType("PKWTT")} />
                    PKWTT
                  </label>
                </div>
              </div>
              {contractType === "PKWT" && (
                <div className="field">
                  <label htmlFor="contractEnd">Kontrak berakhir</label>
                  <input className="input" id="contractEnd" name="contractEnd" type="date" defaultValue={toDateInputValue(employee.contractEnd)} />
                </div>
              )}
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="kasbon">Total kasbon (Rp)</label>
                  <input
                    className="input"
                    id="kasbon"
                    name="kasbon"
                    type="number"
                    min={0}
                    value={kasbon}
                    onChange={(e) => setKasbon(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="kasbonCicilan">Dicicil (bulan)</label>
                  <input
                    className="input"
                    id="kasbonCicilan"
                    name="kasbonCicilan"
                    type="number"
                    min={1}
                    max={24}
                    value={kasbonCicilan}
                    onChange={(e) => setKasbonCicilan(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>
              {kasbon > 0 && (
                <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>
                  {kasbonCicilan > 1
                    ? `Dipotong ${formatRp(kasbonPerBulan(kasbon, kasbonCicilan))}/bulan selama ${kasbonCicilan} bulan dari gaji.`
                    : "Dipotong penuh dari gaji bulan berikutnya. Ubah \"Dicicil\" untuk mencicil 2–4 bulan."}
                </p>
              )}
              <div className="field">
                <label htmlFor="cutiKuota">Kuota cuti tahunan (hari)</label>
                <input className="input" id="cutiKuota" name="cutiKuota" type="number" min={0} defaultValue={employee.cutiKuota} />
              </div>

              <div className="card-kicker">Potongan BPJS (kosongkan = pakai rumus otomatis)</div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="bpjsKesehatanOverride">BPJS Kesehatan (Rp)</label>
                  <input
                    className="input"
                    id="bpjsKesehatanOverride"
                    name="bpjsKesehatanOverride"
                    type="number"
                    min={0}
                    placeholder="Otomatis"
                    defaultValue={employee.bpjsKesehatanOverride ?? ""}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="bpjsKetenagakerjaanOverride">BPJS Ketenagakerjaan (Rp)</label>
                  <input
                    className="input"
                    id="bpjsKetenagakerjaanOverride"
                    name="bpjsKetenagakerjaanOverride"
                    type="number"
                    min={0}
                    placeholder="Otomatis"
                    defaultValue={employee.bpjsKetenagakerjaanOverride ?? ""}
                  />
                </div>
              </div>

              {delError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{delError}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" disabled={delPending} onClick={handleDelete} style={{ marginRight: "auto" }}>
                  {delPending ? "Menghapus…" : "Hapus"}
                </button>
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
