"use client";

import { useState } from "react";
import { payAllowanceBatch } from "@/app/(app)/penggajian/actions";
import { EmployeeCombobox, type EmployeeOption } from "@/components/EmployeeCombobox";

function todayInputValue() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

type Row = { key: number; employeeId: string; amount: string };
let nextKey = 1;

function emptyRow(): Row {
  return { key: nextKey++, employeeId: "", amount: "" };
}

export function PayAllowanceDialog({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(() => todayInputValue());

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow()]);
  }

  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  function close() {
    setOpen(false);
    setError("");
    setRows([emptyRow()]);
    setDesc("");
    setDate(todayInputValue());
  }

  const validRows = rows.filter((r) => r.employeeId && parseInt(r.amount, 10) > 0);

  async function handleSubmit() {
    setPending(true);
    setError("");
    try {
      await payAllowanceBatch(
        validRows.map((r) => ({ employeeId: r.employeeId, amount: parseInt(r.amount, 10) })),
        desc.trim() || null,
        date,
      );
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Bayar bonus/insentif
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ maxWidth: 560, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Bayar Bonus/Insentif</div>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                {rows.map((row, i) => (
                  <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr 160px auto", gap: "var(--space-2)", alignItems: "start" }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      {i === 0 && <label>Karyawan</label>}
                      <EmployeeCombobox
                        employees={employees}
                        name={`employeeId-${row.key}`}
                        value={row.employeeId}
                        onChange={(id) => updateRow(row.key, { employeeId: id })}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      {i === 0 && <label>Jumlah (Rp)</label>}
                      <input
                        className="input"
                        type="number"
                        min={1}
                        placeholder="0"
                        value={row.amount}
                        onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ marginTop: i === 0 ? 22 : 0 }}
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length <= 1}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-secondary" onClick={addRow} style={{ width: "fit-content" }}>
                + Tambah karyawan
              </button>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="allow-desc">Keterangan</label>
                  <input className="input" id="allow-desc" placeholder="mis. Bonus akhir tahun" value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="allow-date">Tanggal</label>
                  <input className="input" id="allow-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}

              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={close}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary" disabled={pending || validRows.length === 0} onClick={handleSubmit}>
                  {pending ? "Menyimpan…" : `Bayar ke ${validRows.length || ""} karyawan`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
