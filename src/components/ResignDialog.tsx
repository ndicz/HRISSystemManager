"use client";

import { useState, useRef } from "react";
import { resignEmployee } from "@/app/(app)/karyawan/actions";

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function ResignDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await resignEmployee(formData);
      setOpen(false);
      formRef.current?.reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Resign
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Resign &mdash; {employeeName}</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <input type="hidden" name="employeeId" value={employeeId} />
              <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
                Karyawan akan dipindahkan ke riwayat karyawan keluar dan tidak lagi muncul di daftar absensi/penggajian aktif.
              </p>
              <div className="field">
                <label htmlFor="resignDate">Tanggal resign</label>
                <input className="input" id="resignDate" name="resignDate" type="date" required defaultValue={todayIso()} />
              </div>
              <div className="field">
                <label htmlFor="resignReason">Alasan</label>
                <input className="input" id="resignReason" name="resignReason" placeholder="mis. Mengundurkan diri, habis kontrak, PHK" />
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Menyimpan…" : "Konfirmasi resign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
