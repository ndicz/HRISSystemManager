"use client";

import { useState, useRef } from "react";
import { addLeaveRequest } from "@/app/(app)/cuti/actions";
import { EmployeeCombobox } from "@/components/EmployeeCombobox";

type Option = { id: string; name: string; empCode: string; sisa: number };

export function AddLeaveDialog({ employees }: { employees: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const selected = employees.find((e) => e.id === employeeId);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addLeaveRequest(formData);
      setOpen(false);
      formRef.current?.reset();
      setEmployeeId("");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Ajukan cuti</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Ajukan cuti</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="employeeId">Karyawan</label>
                <EmployeeCombobox employees={employees} name="employeeId" id="employeeId" value={employeeId} onChange={setEmployeeId} />
                {selected && (
                  <p style={{ fontSize: 12, opacity: 0.65, margin: "4px 0 0" }}>
                    Sisa kuota cuti tahunan: <strong>{selected.sisa} hari</strong>
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="type">Jenis cuti</label>
                <select className="input" id="type" name="type">
                  <option>Cuti Tahunan</option>
                  <option>Sakit</option>
                  <option>Melahirkan</option>
                  <option>Lainnya</option>
                </select>
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field">
                  <label htmlFor="startDate">Mulai</label>
                  <input className="input" id="startDate" name="startDate" type="date" required />
                </div>
                <div className="field">
                  <label htmlFor="endDate">Selesai</label>
                  <input className="input" id="endDate" name="endDate" type="date" required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="reason">Alasan</label>
                <input className="input" id="reason" name="reason" placeholder="Keterangan singkat" />
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending || !employeeId}>{pending ? "Mengirim…" : "Ajukan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
