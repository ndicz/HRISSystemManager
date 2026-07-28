"use client";

import { useState, useRef } from "react";
import { createMbp } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";
import { RupiahInput } from "@/components/RupiahInput";
import type { ClientOption } from "@/components/ClientCombobox";

type PendingRequest = { id: string; itemName: string; unit: string; qty: number; cost: number; requesterName: string };

type ItemRow = { rowId: number; desc: string; qty: number; cost: number; price: number; sourceRequestId: string | null };

let nextRowId = 1;

function emptyRow(): ItemRow {
  return { rowId: nextRowId++, desc: "", qty: 1, cost: 0, price: 0, sourceRequestId: null };
}

function markupLabel(cost: number, price: number): string {
  if (cost <= 0) return price > 0 ? "cost belum diisi" : "";
  const pct = Math.round(((price - cost) / cost) * 100);
  return (pct >= 0 ? "+" : "") + pct + "%";
}

export function CreateMbpDialog({ clients, pendingRequests }: { clients: ClientOption[]; pendingRequests: PendingRequest[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const [clientMode, setClientMode] = useState<"pilih" | "manual">(clients.length > 0 ? "pilih" : "manual");
  const [clientId, setClientId] = useState("");
  const [clientNameManual, setClientNameManual] = useState("");

  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const checkedRequestIds = new Set(rows.map((r) => r.sourceRequestId).filter(Boolean));

  function updateRow(rowId: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }
  function toggleRequest(req: PendingRequest, checked: boolean) {
    if (checked) {
      setRows((prev) => [
        ...prev,
        { rowId: nextRowId++, desc: `${req.itemName} (${req.unit})`, qty: req.qty, cost: req.cost, price: req.cost, sourceRequestId: req.id },
      ]);
    } else {
      setRows((prev) => prev.filter((r) => r.sourceRequestId !== req.id));
    }
  }

  function resetForm() {
    setRows([emptyRow()]);
    setClientId(""); setClientNameManual("");
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await createMbp(formData);
      setOpen(false);
      formRef.current?.reset();
      resetForm();
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  const total = rows.reduce((s, r) => s + r.qty * r.price, 0);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Buat MBP</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(640px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Buat MBP (Material Budget Plan)</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ marginBottom: 0 }}>Klien</label>
                  {clients.length > 0 && (
                    <div className="seg" role="radiogroup">
                      <label className="seg-opt"><input type="radio" checked={clientMode === "pilih"} onChange={() => setClientMode("pilih")} /> Pilih klien</label>
                      <label className="seg-opt"><input type="radio" checked={clientMode === "manual"} onChange={() => setClientMode("manual")} /> Isi manual</label>
                    </div>
                  )}
                </div>
                {clientMode === "pilih" ? (
                  <select className="input" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                    <option value="">Pilih klien…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                ) : (
                  <input className="input" name="clientNameManual" value={clientNameManual} onChange={(e) => setClientNameManual(e.target.value)} placeholder="Nama klien (belum tercatat sebagai Client)" />
                )}
              </div>

              <div className="field">
                <label htmlFor="mbp-jobTitle">Nama pekerjaan (opsional)</label>
                <input className="input" id="mbp-jobTitle" name="jobTitle" placeholder="mis. Pengadaan AC ruang rawat inap" />
              </div>

              {pendingRequests.length > 0 && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Tarik dari permintaan yang sudah disetujui</label>
                  <div style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto", padding: "var(--space-2)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)" }}>
                    {pendingRequests.map((req) => (
                      <label key={req.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          style={{ width: "auto" }}
                          checked={checkedRequestIds.has(req.id)}
                          onChange={(e) => toggleRequest(req, e.target.checked)}
                        />
                        {req.itemName} — {req.qty} {req.unit} ({formatRp(req.cost)}) &middot; {req.requesterName}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="field" style={{ marginBottom: 0 }}><label>Item</label></div>
              {rows.map((row, idx) => {
                const i = idx + 1;
                return (
                  <div key={row.rowId} style={{ display: "grid", gap: 4, padding: "var(--space-2)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", borderRadius: "var(--radius-md)" }}>
                    <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: "var(--space-2)", alignItems: "center" }}>
                      <input
                        className="input" name={`desc${i}`} value={row.desc}
                        onChange={(e) => updateRow(row.rowId, { desc: e.target.value })}
                        placeholder={i === 1 ? "Nama item" : `Item ke-${i} (opsional)`}
                      />
                      <input
                        className="input" name={`qty${i}`} type="number" min={1} value={row.qty}
                        onChange={(e) => updateRow(row.rowId, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        placeholder="Qty"
                      />
                      <button type="button" className="btn btn-ghost" onClick={() => removeRow(row.rowId)} disabled={rows.length <= 1} title="Hapus item">&times;</button>
                    </div>
                    <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "var(--space-2)", alignItems: "center" }}>
                      <RupiahInput name={`cost${i}`} defaultValue={row.cost} placeholder="Harga asli (cost)" onValueChange={(v) => updateRow(row.rowId, { cost: v })} />
                      <RupiahInput name={`price${i}`} defaultValue={row.price} placeholder="Harga jual" onValueChange={(v) => updateRow(row.rowId, { price: v })} />
                      <span style={{ fontSize: 12, opacity: 0.65, whiteSpace: "nowrap" }}>{markupLabel(row.cost, row.price)}</span>
                    </div>
                    {row.sourceRequestId && <input type="hidden" name={`sourceRequestId${i}`} value={row.sourceRequestId} />}
                  </div>
                );
              })}
              <button type="button" className="btn btn-secondary" onClick={addRow} style={{ width: "fit-content" }}>+ Tambah item</button>

              <p style={{ fontSize: 13, margin: 0 }}>Total harga jual: <strong>{formatRp(total)}</strong></p>

              <div className="field">
                <label htmlFor="mbp-signerName">Nama penandatangan (opsional)</label>
                <input className="input" id="mbp-signerName" name="signerName" placeholder="mis. Budi Santoso, Direktur" />
              </div>

              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Buat MBP"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
