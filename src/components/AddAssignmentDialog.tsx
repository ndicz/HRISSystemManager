"use client";

import { useState, useRef } from "react";
import { addAssignment } from "@/app/(app)/karyawan/actions";
import { EmployeeCombobox, type EmployeeOption } from "@/components/EmployeeCombobox";
import { monthKey } from "@/lib/finance";

function monthOptions() {
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names.map((n, i) => ({ value: "2026-" + String(i + 1).padStart(2, "0"), label: n + " 2026" }));
}

export function AddAssignmentDialog({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState(() => monthKey(new Date()));
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addAssignment(formData);
      setOpen(false);
      formRef.current?.reset();
      setEmployeeId("");
      setPeriod(monthKey(new Date()));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Ajukan penugasan
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Ajukan penugasan tambahan</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="assign-employeeId">Karyawan</label>
                <EmployeeCombobox employees={employees} name="employeeId" id="assign-employeeId" value={employeeId} onChange={setEmployeeId} />
              </div>
              <div className="field">
                <label htmlFor="assign-title">Judul penugasan</label>
                <input className="input" id="assign-title" name="title" required placeholder="mis. Lembur proyek klien X" />
              </div>
              <div className="field">
                <label htmlFor="assign-mandays">Estimasi hari (mandays)</label>
                <input className="input" id="assign-mandays" name="mandays" type="number" min={0} placeholder="0" />
              </div>
              <div className="field">
                <label htmlFor="assign-cost">Biaya (Rp)</label>
                <input className="input" id="assign-cost" name="cost" type="number" min={0} placeholder="0" />
              </div>
              <div className="field">
                <label htmlFor="assign-period">Periode slip gaji</label>
                <select className="input" id="assign-period" name="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {monthOptions().map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                  Biaya penugasan ini akan tampil di slip gaji bulan yang dipilih, setelah ditandai selesai.
                </p>
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending || !employeeId}>
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
