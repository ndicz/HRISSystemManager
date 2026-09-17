"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setBonusBatch } from "@/app/(app)/penggajian/actions";
import { EmployeeCombobox, type EmployeeOption } from "@/components/EmployeeCombobox";

type Row = { key: number; employeeId: string; amount: string };
let nextKey = 1;

function emptyRow(): Row {
  return { key: nextKey++, employeeId: "", amount: "" };
}

export function SetBonusDialog({
  employees, period, currentBonuses,
}: {
  employees: EmployeeOption[]; period: string; currentBonuses: { employeeId: string; amount: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Pre-filled with whatever bonus is already set for this period, so
  // reopening shows the current state instead of a blank form — plus one
  // empty row to add someone new.
  const [rows, setRows] = useState<Row[]>(() => {
    const existing = currentBonuses
      .filter((b) => b.amount > 0)
      .map((b) => ({ key: nextKey++, employeeId: b.employeeId, amount: String(b.amount) }));
    return existing.length > 0 ? [...existing, emptyRow()] : [emptyRow()];
  });

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, emptyRow()]);
  }
  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  const validRows = rows.filter((r) => r.employeeId && parseInt(r.amount, 10) >= 0 && r.amount !== "");

  async function handleSubmit() {
    setPending(true);
    setError("");
    try {
      await setBonusBatch(
        period,
        validRows.map((r) => ({ employeeId: r.employeeId, amount: parseInt(r.amount, 10) || 0 })),
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>Atur bonus</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ maxWidth: 560, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Bonus &mdash; {period}</div>
            <p style={{ fontSize: 12.5, opacity: 0.65, marginTop: -4, marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
              Bonus di sini ikut masuk ke total Gaji Bulanan periode ini, dan cair bareng gajinya begitu &ldquo;Bayar
              Gaji&rdquo; diklik — bukan transaksi kas terpisah.
            </p>
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
                        min={0}
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

              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}

              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary" disabled={pending || validRows.length === 0} onClick={handleSubmit}>
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
