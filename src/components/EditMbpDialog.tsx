"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateMbp } from "@/app/(app)/mbp/actions";
import { findOrCreateClientByName } from "@/app/(app)/klien/actions";
import { formatRp } from "@/lib/payroll";
import { mbpPpnValue } from "@/lib/finance";
import { RupiahInput } from "@/components/RupiahInput";
import { ClientCombobox, type ClientOption } from "@/components/ClientCombobox";

type PendingRequest = { id: string; itemName: string; unit: string; qty: number; cost: number; requesterName: string };

// priceRev only increments when price is set programmatically (typing a
// markup %) — bumping it forces the RupiahInput below to remount and pick
// up the new defaultValue. See CreateMbpDialog for the same pattern.
type ItemRow = { rowId: number; desc: string; qty: number; cost: number; price: number; priceRev: number; sourceRequestId: string | null };

let nextRowId = 1;

function emptyRow(): ItemRow {
  return { rowId: nextRowId++, desc: "", qty: 1, cost: 0, price: 0, priceRev: 0, sourceRequestId: null };
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

export function EditMbpDialog({ mbp, clients, siteNames, pendingRequests, onSuccess }: { mbp: EditableMbp; clients: ClientOption[]; siteNames: string[]; pendingRequests: PendingRequest[]; onSuccess?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [clientId, setClientId] = useState(mbp.clientId ?? "");
  const [clientOptions, setClientOptions] = useState(clients);

  // Older MBPs may only have a typed clientNameManual (no real Client row
  // yet, from before the client picker always resolved to one). Resolve it
  // into a real client the first time this MBP is opened for editing, so
  // the combobox has something to preselect instead of showing blank.
  useEffect(() => {
    if (mbp.clientId || !mbp.clientNameManual) return;
    findOrCreateClientByName(mbp.clientNameManual).then((res) => {
      setClientId(res.id);
      setClientOptions((prev) => (prev.some((c) => c.id === res.id) ? prev : [...prev, res]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = useState<ItemRow[]>(
    mbp.items.length > 0
      ? mbp.items.map((it) => ({ rowId: nextRowId++, desc: it.desc, qty: it.qty, cost: it.cost, price: it.price, priceRev: 0, sourceRequestId: null }))
      : [emptyRow()],
  );
  const checkedRequestIds = new Set(rows.map((r) => r.sourceRequestId).filter(Boolean));

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
              <div className="field">
                <label htmlFor={`edit-mbp-clientId-${mbp.id}`}>Klien</label>
                <ClientCombobox clients={clientOptions} siteNames={siteNames} name="clientId" id={`edit-mbp-clientId-${mbp.id}`} value={clientId} onChange={(id) => setClientId(id)} />
              </div>

              <div className="field">
                <label htmlFor={`edit-mbp-jobTitle-${mbp.id}`}>Nama pekerjaan (opsional)</label>
                <input className="input" id={`edit-mbp-jobTitle-${mbp.id}`} name="jobTitle" defaultValue={mbp.jobTitle ?? ""} placeholder="mis. Pengadaan AC ruang rawat inap" />
              </div>

              {pendingRequests.length > 0 && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Tarik dari permintaan barang</label>
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
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      <input
                        className="input" name={`desc${i}`} value={row.desc}
                        onChange={(e) => updateRow(row.rowId, { desc: e.target.value })}
                        placeholder={i === 1 ? "Nama item" : `Item ke-${i} (opsional)`}
                        style={{ flex: "3 1 200px" }}
                      />
                      <input
                        className="input" name={`qty${i}`} type="number" min={1} value={row.qty}
                        onChange={(e) => updateRow(row.rowId, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        placeholder="Qty"
                        style={{ flex: "0 1 70px" }}
                      />
                      <button type="button" className="btn btn-ghost" onClick={() => removeRow(row.rowId)} disabled={rows.length <= 1} title="Hapus item" style={{ flexShrink: 0 }}>&times;</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                      <RupiahInput name={`cost${i}`} defaultValue={row.cost} placeholder="Harga asli (cost)" onValueChange={(v) => updateRow(row.rowId, { cost: v })} />
                      <RupiahInput
                        key={`price-${row.rowId}-${row.priceRev}`}
                        name={`price${i}`}
                        defaultValue={row.price}
                        placeholder="Harga jual"
                        onValueChange={(v) => updateRow(row.rowId, { price: v })}
                      />
                    </div>
                    <div style={{ maxWidth: 140 }}>
                      <label htmlFor={`markup-${row.rowId}`} style={{ display: "block", fontSize: 12, marginBottom: 3, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>Markup %</label>
                      <input
                        className="input"
                        id={`markup-${row.rowId}`}
                        type="number"
                        inputMode="numeric"
                        placeholder="0"
                        disabled={row.cost <= 0}
                        value={markupPercentOf(row.cost, row.price)}
                        onChange={(e) => {
                          const pct = parseInt(e.target.value, 10) || 0;
                          const newPrice = Math.round(row.cost * (1 + pct / 100));
                          updateRow(row.rowId, { price: newPrice, priceRev: row.priceRev + 1 });
                        }}
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
                  <label htmlFor={`edit-mbp-ppnPercent-${mbp.id}`} style={{ fontSize: 12 }}>Ubah persen pajak</label>
                  <input
                    className="input"
                    id={`edit-mbp-ppnPercent-${mbp.id}`}
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
