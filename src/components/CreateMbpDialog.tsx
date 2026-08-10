"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createMbp } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";
import { mbpPpnValue } from "@/lib/finance";
import { RupiahInput } from "@/components/RupiahInput";
import { ClientCombobox, type ClientOption } from "@/components/ClientCombobox";

type PendingRequest = { id: string; itemName: string; unit: string; qty: number; cost: number; requesterName: string };

// priceRev only increments when price is set programmatically (typing a
// markup %) — bumping it forces the RupiahInput below to remount and pick
// up the new defaultValue. Normal typing directly into the price field
// never touches priceRev, so it never remounts (which would otherwise
// reset the cursor to the end on every keystroke).
type ItemRow = { rowId: number; desc: string; qty: number; cost: number; price: number; priceRev: number; sourceRequestId: string | null };

let nextRowId = 1;

function emptyRow(): ItemRow {
  return { rowId: nextRowId++, desc: "", qty: 1, cost: 0, price: 0, priceRev: 0, sourceRequestId: null };
}

function markupPercentOf(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return Math.round(((price - cost) / cost) * 100);
}

export function CreateMbpDialog({
  clients, siteNames, pendingRequests, onSuccess,
}: {
  clients: ClientOption[]; siteNames: string[]; pendingRequests: PendingRequest[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const [clientId, setClientId] = useState("");

  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const checkedRequestIds = new Set(rows.map((r) => r.sourceRequestId).filter(Boolean));

  const [withPpn, setWithPpn] = useState(true);
  const [ppnPercent, setPpnPercent] = useState(11);

  function updateRow(rowId: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }
  // One MBP can cover several requests at once (e.g. one client asked for
  // multiple things) — checking a request adds its own item row, already
  // filled with name/qty/cost, on top of whatever else is there.
  // Unchecking removes just that row again.
  function toggleRequest(req: PendingRequest, checked: boolean) {
    if (checked) {
      setRows((prev) => [
        ...prev,
        { rowId: nextRowId++, desc: `${req.itemName} (${req.unit})`, qty: req.qty, cost: req.cost, price: req.cost, priceRev: 0, sourceRequestId: req.id },
      ]);
    } else {
      setRows((prev) => prev.filter((r) => r.sourceRequestId !== req.id));
    }
  }

  function resetForm() {
    setRows([emptyRow()]);
    setClientId("");
    setWithPpn(true); setPpnPercent(11);
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
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Buat MBP</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(640px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Buat MBP (Material Budget Plan)</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="mbp-clientId">Klien</label>
                <ClientCombobox clients={clients} siteNames={siteNames} name="clientId" id="mbp-clientId" value={clientId} onChange={(id) => setClientId(id)} />
              </div>

              <div className="field">
                <label htmlFor="mbp-jobTitle">Nama pekerjaan (opsional)</label>
                <input className="input" id="mbp-jobTitle" name="jobTitle" placeholder="mis. Pengadaan AC ruang rawat inap" />
              </div>

              {pendingRequests.length > 0 && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Tarik dari permintaan barang</label>
                  <div style={{ display: "grid", gap: 4, maxHeight: 200, overflowY: "auto", padding: "var(--space-2)", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)" }}>
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
                  <p style={{ fontSize: 11, opacity: 0.55, margin: "var(--space-1) 0 0" }}>Bisa centang lebih dari satu — tiap yang dicentang otomatis di-ACC dan langsung jadi item sendiri di bawah.</p>
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
                    {row.sourceRequestId && <input type="hidden" name={`sourceRequestId${i}`} value={row.sourceRequestId} />}
                  </div>
                );
              })}
              <button type="button" className="btn btn-secondary" onClick={addRow} style={{ width: "fit-content" }}>+ Tambah item</button>

              <label className="field" style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row", marginBottom: 0 }}>
                <input type="checkbox" name="withPpn" checked={withPpn} onChange={(e) => setWithPpn(e.target.checked)} style={{ width: "auto" }} />
                <span>Kena pajak (PPN {ppnPercent}%)</span>
              </label>
              {withPpn && (
                <div className="field" style={{ marginBottom: 0, maxWidth: 140 }}>
                  <label htmlFor="mbp-ppnPercent" style={{ fontSize: 12 }}>Ubah persen pajak</label>
                  <input
                    className="input"
                    id="mbp-ppnPercent"
                    name="ppnPercent"
                    type="number"
                    min={0}
                    value={ppnPercent}
                    onChange={(e) => setPpnPercent(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>
              )}

              <div style={{ fontSize: 13, display: "grid", gap: 4, padding: "var(--space-3)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Subtotal</span><span>{formatRp(subtotal)}</span></div>
                {withPpn && <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">PPN {ppnPercent}%</span><span>{formatRp(ppnValue)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Total</span><span>{formatRp(total)}</span></div>
              </div>

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
