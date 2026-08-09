"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMbp } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";
import { mbpPpnValue } from "@/lib/finance";
import { RupiahInput } from "@/components/RupiahInput";
import type { ClientOption } from "@/components/ClientCombobox";

// priceRev only increments when price is set programmatically (typing a
// markup %) — bumping it forces the RupiahInput below to remount and pick
// up the new defaultValue. See CreateMbpDialog for the same pattern.
type ItemRow = { rowId: number; desc: string; qty: number; cost: number; price: number; priceRev: number };

let nextRowId = 1;

function emptyRow(): ItemRow {
  return { rowId: nextRowId++, desc: "", qty: 1, cost: 0, price: 0, priceRev: 0 };
}

function markupPercentOf(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return Math.round(((price - cost) / cost) * 100);
}

export type EditableMbp = {
  id: string;
  mbpNo: string;
  clientId: string | null;
  clientNameManual: string | null;
  jobTitle: string | null;
  signerName: string | null;
  withPpn: boolean;
  ppnPercent: number;
  items: { desc: string; qty: number; cost: number; price: number }[];
};

export function EditMbpDialog({ mbp, clients, onSuccess }: { mbp: EditableMbp; clients: ClientOption[]; onSuccess?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Reflects what this MBP actually has, not the current client list —
  // an MBP created via clientNameManual stays in manual mode even if
  // Client records exist now, since it genuinely has no clientId to preselect.
  const [clientMode, setClientMode] = useState<"pilih" | "manual">(mbp.clientId ? "pilih" : "manual");
  const [clientId, setClientId] = useState(mbp.clientId ?? "");
  const [clientNameManual, setClientNameManual] = useState(mbp.clientNameManual ?? "");

  const [rows, setRows] = useState<ItemRow[]>(
    mbp.items.length > 0
      ? mbp.items.map((it) => ({ rowId: nextRowId++, desc: it.desc, qty: it.qty, cost: it.cost, price: it.price, priceRev: 0 }))
      : [emptyRow()],
  );

  const [withPpn, setWithPpn] = useState(mbp.withPpn);
  const [ppnPercent, setPpnPercent] = useState(mbp.ppnPercent);

  function updateRow(rowId: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateMbp(mbp.id, formData);
      setOpen(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  const subtotal = rows.reduce((s, r) => s + r.qty * r.price, 0);
  const ppnValue = mbpPpnValue(rows, withPpn, ppnPercent);
  const total = subtotal + ppnValue;

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(640px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit MBP &mdash; {mbp.mbpNo}</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
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
                <label htmlFor={`edit-mbp-jobTitle-${mbp.id}`}>Nama pekerjaan (opsional)</label>
                <input className="input" id={`edit-mbp-jobTitle-${mbp.id}`} name="jobTitle" defaultValue={mbp.jobTitle ?? ""} placeholder="mis. Pengadaan AC ruang rawat inap" />
              </div>

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
                    <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: "var(--space-2)", alignItems: "center" }}>
                      <RupiahInput name={`cost${i}`} defaultValue={row.cost} placeholder="Harga asli (cost)" onValueChange={(v) => updateRow(row.rowId, { cost: v })} />
                      <RupiahInput
                        key={`price-${row.rowId}-${row.priceRev}`}
                        name={`price${i}`}
                        defaultValue={row.price}
                        placeholder="Harga jual"
                        onValueChange={(v) => updateRow(row.rowId, { price: v })}
                      />
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        placeholder="Markup"
                        title="Markup %"
                        disabled={row.cost <= 0}
                        value={markupPercentOf(row.cost, row.price)}
                        onChange={(e) => {
                          const pct = parseInt(e.target.value, 10) || 0;
                          const newPrice = Math.round(row.cost * (1 + pct / 100));
                          updateRow(row.rowId, { price: newPrice, priceRev: row.priceRev + 1 });
                        }}
                        style={{ textAlign: "right" }}
                      />
                    </div>
                    {row.cost <= 0 && <p style={{ fontSize: 11, opacity: 0.55, margin: 0 }}>Isi cost dulu untuk hitung markup % otomatis.</p>}
                  </div>
                );
              })}
              <button type="button" className="btn btn-secondary" onClick={addRow} style={{ width: "fit-content" }}>+ Tambah item</button>

              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <label className="field" style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row", marginBottom: 0 }}>
                  <input type="checkbox" name="withPpn" checked={withPpn} onChange={(e) => setWithPpn(e.target.checked)} style={{ width: "auto" }} />
                  <span>Kena pajak (PPN)</span>
                </label>
                <div className="field" style={{ marginBottom: 0 }}>
                  <input
                    className="input"
                    name="ppnPercent"
                    type="number"
                    min={0}
                    disabled={!withPpn}
                    value={ppnPercent}
                    onChange={(e) => setPpnPercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Persen PPN"
                  />
                </div>
              </div>

              <div style={{ fontSize: 13, display: "grid", gap: 4, padding: "var(--space-3)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Subtotal (harga jual)</span><span>{formatRp(subtotal)}</span></div>
                {withPpn && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">PPN {ppnPercent}%</span><span>{formatRp(ppnValue)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Total</span><span>{formatRp(total)}</span></div>
              </div>

              <div className="field">
                <label htmlFor={`edit-mbp-signerName-${mbp.id}`}>Nama penandatangan (opsional)</label>
                <input className="input" id={`edit-mbp-signerName-${mbp.id}`} name="signerName" defaultValue={mbp.signerName ?? ""} placeholder="mis. Budi Santoso, Direktur" />
              </div>

              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
