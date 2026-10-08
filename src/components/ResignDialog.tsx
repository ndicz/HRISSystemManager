"use client";

import { useState, useRef } from "react";
import { resignEmployee } from "@/app/(app)/karyawan/actions";
import { formatActionError } from "@/lib/errors";
import { submitForm } from "@/lib/submitForm";

function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function ResignDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await resignEmployee(formData);
      setOpen(false);
      formRef.current?.reset();
    } catch (err) {
      setError(formatActionError(err));
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
            <form ref={formRef} onSubmit={(e) => submitForm(e, handleSubmit)} style={{ display: "grid", gap: "var(--space-3)" }}>
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
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
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
