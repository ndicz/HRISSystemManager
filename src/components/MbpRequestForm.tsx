"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addMbpRequest } from "@/app/(app)/mbp/actions";
import { formatRp } from "@/lib/payroll";
import { RupiahInput } from "@/components/RupiahInput";
import { EmployeeCombobox, type EmployeeOption } from "@/components/EmployeeCombobox";

type ItemOption = { id: string; name: string; unit: string; price: number };

export function MbpRequestForm({
  items, employees, siteNames, lockedRequesterName, onSuccess,
}: {
  items: ItemOption[]; employees: EmployeeOption[]; siteNames: string[];
  // Set when the submitting user is a logged-in field employee (role
  // EMPLOYEE) — the requester picker is hidden entirely and every request
  // they submit is attributed to their own name, not something they type.
  lockedRequesterName?: string;
  // Called after a successful submit so the parent can refetch its list —
  // more reliable here than the implicit page refresh a Server Action
  // normally triggers, which doesn't reach this already-mounted tree.
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Barang: dari katalog Gudang (harga terisi otomatis) atau barang luar
  // (diketik manual) — sama seperti trackStock item vs "beli sesuai
  // permintaan" di RequestItemDialog, tapi di sini keduanya sama-sama tidak
  // menyentuh stok Gudang, murni untuk keperluan penawaran ke klien.
  const [itemMode, setItemMode] = useState<"gudang" | "luar">(items.length > 0 ? "gudang" : "luar");
  const [itemId, setItemId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState("");
  const [manualCost, setManualCost] = useState(0);
  const [qty, setQty] = useState(1);

  const [requesterMode, setRequesterMode] = useState<"pilih" | "manual">(employees.length > 0 ? "pilih" : "manual");
  const [requesterEmployeeId, setRequesterEmployeeId] = useState("");
  const [requesterManualName, setRequesterManualName] = useState("");
  const requesterName = lockedRequesterName ?? (requesterMode === "pilih" ? (employees.find((e) => e.id === requesterEmployeeId)?.name ?? "") : requesterManualName);

  const [siteMode, setSiteMode] = useState<"pilih" | "manual">(siteNames.length > 0 ? "pilih" : "manual");
  const [sitePicked, setSitePicked] = useState("");
  const [siteManual, setSiteManual] = useState("");
  const siteName = siteMode === "pilih" ? sitePicked : siteManual;

  const selected = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const cost = itemMode === "gudang" ? (selected?.price ?? 0) : manualCost;
  const total = cost * qty;
  const canSubmit = itemMode === "gudang" ? !!itemId : !!manualName.trim();
  // A field requester submits what they need, not what it costs — cost/
  // markup is office business, decided later at ACC/MBP-building time.
  const hidePrice = !!lockedRequesterName;

  function resetFields() {
    setItemId(""); setManualName(""); setManualUnit(""); setManualCost(0); setQty(1);
    setRequesterEmployeeId(""); setRequesterManualName("");
    setSitePicked(""); setSiteManual("");
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await addMbpRequest(formData);
      setOpen(false);
      formRef.current?.reset();
      resetFields();
      setFormKey((k) => k + 1);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Permintaan barang</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Permintaan barang MBP</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ marginBottom: 0 }}>Barang</label>
                  <div className="seg" role="radiogroup">
                    <label className="seg-opt"><input type="radio" checked={itemMode === "gudang"} onChange={() => setItemMode("gudang")} disabled={items.length === 0} /> Dari Gudang</label>
                    <label className="seg-opt"><input type="radio" checked={itemMode === "luar"} onChange={() => setItemMode("luar")} /> Barang luar</label>
                  </div>
                </div>
                {itemMode === "gudang" ? (
                  <select className="input" name="itemId" required value={itemId} onChange={(e) => { setItemId(e.target.value); setError(""); }}>
                    <option value="">Pilih barang…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{hidePrice ? `${i.name} (${i.unit})` : `${i.name} — ${formatRp(i.price)}/${i.unit}`}</option>
                    ))}
                  </select>
                ) : (
                  <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-2)" }}>
                    <input className="input" name="itemName" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nama barang" />
                    <input className="input" name="unit" value={manualUnit} onChange={(e) => setManualUnit(e.target.value)} placeholder="Satuan (mis. unit)" />
                  </div>
                )}
              </div>

              {hidePrice ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="mbp-req-qty">Jumlah</label>
                  <input className="input" id="mbp-req-qty" name="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                </div>
              ) : (
                <>
                  <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor="mbp-req-qty">Jumlah</label>
                      <input className="input" id="mbp-req-qty" name="qty" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Harga asli (cost)</label>
                      {itemMode === "gudang" ? (
                        <div className="input" style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>{selected ? formatRp(selected.price) : "-"}</div>
                      ) : (
                        <RupiahInput name="cost" defaultValue={0} onValueChange={setManualCost} placeholder="0" />
                      )}
                    </div>
                  </div>
                  {(selected || (itemMode === "luar" && manualName)) && (
                    <p style={{ fontSize: 13, margin: 0 }}>Total nilai (cost): <strong>{formatRp(total)}</strong> — harga jual ke klien ditentukan nanti saat dibuat MBP.</p>
                  )}
                </>
              )}

              {lockedRequesterName ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Nama peminta</label>
                  <div className="input" style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>{lockedRequesterName}</div>
                  <input type="hidden" name="requesterName" value={requesterName} />
                </div>
              ) : (
                <div className="field" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label htmlFor="mbp-req-requester" style={{ marginBottom: 0 }}>Nama peminta</label>
                    {employees.length > 0 && (
                      <div className="seg" role="radiogroup">
                        <label className="seg-opt"><input type="radio" checked={requesterMode === "pilih"} onChange={() => setRequesterMode("pilih")} /> Pilih karyawan</label>
                        <label className="seg-opt"><input type="radio" checked={requesterMode === "manual"} onChange={() => setRequesterMode("manual")} /> Isi manual</label>
                      </div>
                    )}
                  </div>
                  {requesterMode === "pilih" ? (
                    <EmployeeCombobox employees={employees} name="_requesterEmployee" id="mbp-req-requester" value={requesterEmployeeId} onChange={setRequesterEmployeeId} />
                  ) : (
                    <input className="input" id="mbp-req-requester" value={requesterManualName} onChange={(e) => setRequesterManualName(e.target.value)} placeholder="Nama pemohon" />
                  )}
                  <input type="hidden" name="requesterName" value={requesterName} />
                </div>
              )}

              <div className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label htmlFor="mbp-req-site" style={{ marginBottom: 0 }}>Tempat kerja (opsional)</label>
                  {siteNames.length > 0 && (
                    <div className="seg" role="radiogroup">
                      <label className="seg-opt"><input type="radio" checked={siteMode === "pilih"} onChange={() => setSiteMode("pilih")} /> Pilih</label>
                      <label className="seg-opt"><input type="radio" checked={siteMode === "manual"} onChange={() => setSiteMode("manual")} /> Isi manual</label>
                    </div>
                  )}
                </div>
                {siteMode === "pilih" ? (
                  <select className="input" id="mbp-req-site" value={sitePicked} onChange={(e) => setSitePicked(e.target.value)}>
                    <option value="">Tidak ada</option>
                    {siteNames.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="input" id="mbp-req-site" value={siteManual} onChange={(e) => setSiteManual(e.target.value)} placeholder="mis. RS Borromeus" />
                )}
                <input type="hidden" name="siteName" value={siteName} />
              </div>

              <div className="field">
                <label htmlFor="mbp-req-note">Keterangan (opsional)</label>
                <input className="input" id="mbp-req-note" name="note" placeholder="mis. Untuk perbaikan AC ruang rawat inap" />
              </div>
              {error && <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending || !canSubmit || !requesterName}>{pending ? "Menyimpan…" : "Ajukan permintaan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
