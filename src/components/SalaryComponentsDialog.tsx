"use client";

import { useState, useTransition } from "react";
import { fetchSalaryComponents, addSalaryComponent, updateSalaryComponent, removeSalaryComponent } from "@/app/(app)/karyawan/actions";
import { formatRp } from "@/lib/payroll";

type Component = { id: string; name: string; amount: number };

export function SalaryComponentsDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [components, setComponents] = useState<Component[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setOpen(true);
    setError("");
    setEditingId(null);
    startTransition(async () => {
      const data = await fetchSalaryComponents(employeeId);
      setComponents(data);
    });
  }

  function startEdit(c: Component) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditAmount(String(c.amount));
  }

  function handleSaveEdit() {
    if (!editName.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        const data = await updateSalaryComponent(editingId!, editName.trim(), parseInt(editAmount, 10) || 0);
        setComponents(data);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
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
            <div className="dialog-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {components === null ? (
                <p>Memuat&hellip;</p>
              ) : (
                <>
                  <table className="table table-nested" style={{ marginBottom: "var(--space-3)" }}>
                    <thead>
                      <tr>
                        <th>Komponen</th>
                        <th>Jumlah</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((c) =>
                        editingId === c.id ? (
                          <tr key={c.id}>
                            <td>
                              <input className="input" style={{ minHeight: 30, fontSize: 13 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </td>
                            <td>
                              <input
                                className="input"
                                style={{ minHeight: 30, fontSize: 13, width: 130 }}
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                              />
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <button type="button" className="btn btn-primary" disabled={pending || !editName.trim()} onClick={handleSaveEdit}>
                                Simpan
                              </button>
                              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setEditingId(null)}>
                                Batal
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td>
                              {formatRp(c.amount)}
                              {c.amount < 0 && <span className="tag tag-outline" style={{ marginLeft: 6 }}>Potongan</span>}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => startEdit(c)}>
                                Edit
                              </button>
                              <button type="button" className="btn btn-ghost" disabled={pending || components.length <= 1} onClick={() => handleRemove(c.id)}>
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
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
                      <input className="input" id="comp-amount" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-primary" disabled={pending || !newName.trim()} onClick={handleAdd}>
                      Tambah
                    </button>
                  </div>
                  <p style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
                    Gunakan angka negatif untuk potongan, mis. -50000. Klik &quot;Edit&quot; pada baris untuk mengubah komponen yang sudah ada (termasuk Gaji Pokok).
                  </p>
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
