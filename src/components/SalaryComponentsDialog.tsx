"use client";

import { useState, useTransition } from "react";
import { fetchSalaryComponents, addSalaryComponent, removeSalaryComponent } from "@/app/(app)/karyawan/actions";
import { formatRp } from "@/lib/payroll";

type Component = { id: string; name: string; amount: number };

export function SalaryComponentsDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [components, setComponents] = useState<Component[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setError("");
    startTransition(async () => {
      const data = await fetchSalaryComponents(employeeId);
      setComponents(data);
    });
  }

  function handleAdd() {
    if (!newName.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("employeeId", employeeId);
        fd.set("name", newName.trim());
        fd.set("amount", newAmount || "0");
        const data = await addSalaryComponent(fd);
        setComponents(data);
        setNewName("");
        setNewAmount("");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleRemove(componentId: string) {
    setError("");
    startTransition(async () => {
      try {
        const data = await removeSalaryComponent(componentId);
        setComponents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const total = components?.reduce((s, c) => s + c.amount, 0) ?? 0;

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={openDialog}>
        Komponen gaji
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Komponen Gaji &mdash; {employeeName}</div>
            <div className="dialog-body">
              {components === null ? (
                <p>Memuat&hellip;</p>
              ) : (
                <>
                  <table className="table" style={{ marginBottom: "var(--space-3)" }}>
                    <thead>
                      <tr>
                        <th>Komponen</th>
                        <th>Jumlah</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{formatRp(c.amount)}</td>
                          <td>
                            <button type="button" className="btn btn-ghost" disabled={pending || components.length <= 1} onClick={() => handleRemove(c.id)}>
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ fontWeight: 600 }}>Total gaji pokok</td>
                        <td style={{ fontWeight: 600 }}>{formatRp(total)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13 }}>{error}</p>}

                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                      <label htmlFor="comp-name">Nama komponen baru</label>
                      <input className="input" id="comp-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="mis. Tunjangan Transport" />
                    </div>
                    <div className="field" style={{ marginBottom: 0, width: 160 }}>
                      <label htmlFor="comp-amount">Jumlah (Rp)</label>
                      <input className="input" id="comp-amount" type="number" min={0} value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-primary" disabled={pending || !newName.trim()} onClick={handleAdd}>
                      Tambah
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
