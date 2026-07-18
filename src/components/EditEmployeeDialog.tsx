"use client";

import { useState, useRef } from "react";
import { updateEmployeeDetails } from "@/app/(app)/karyawan/actions";

type Emp = {
  id: string;
  name: string;
  contractType: string;
  contractEnd: Date | null;
  kasbon: number;
  cutiKuota: number;
};

function toDateInputValue(d: Date | null) {
  if (!d) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function EditEmployeeDialog({ employee }: { employee: Emp }) {
  const [open, setOpen] = useState(false);
  const [contractType, setContractType] = useState(employee.contractType);
  const [pending, setPending] = useState(false);
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
              <div className="field">
                <label htmlFor="kasbon">Kasbon (Rp)</label>
                <input className="input" id="kasbon" name="kasbon" type="number" min={0} defaultValue={employee.kasbon} />
              </div>
              <div className="field">
                <label htmlFor="cutiKuota">Kuota cuti tahunan (hari)</label>
                <input className="input" id="cutiKuota" name="cutiKuota" type="number" min={0} defaultValue={employee.cutiKuota} />
              </div>
              <div className="dialog-actions">
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
