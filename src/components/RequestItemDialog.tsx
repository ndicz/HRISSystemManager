"use client";

import { useState, useRef, useMemo } from "react";
import { requestItem } from "@/app/(app)/gudang/actions";
import { formatRp } from "@/lib/payroll";
import { EmployeeCombobox, type EmployeeOption } from "@/components/EmployeeCombobox";

type ItemOption = { id: string; name: string; unit: string; qty: number; price: number; trackStock: boolean };

export function RequestItemDialog({ items, employees, siteNames }: { items: ItemOption[]; employees: EmployeeOption[]; siteNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Peminta: pilih dari daftar karyawan (nama diambil dari data), atau
  // ketik manual untuk pemohon yang bukan karyawan tercatat di sistem.
  const [requesterMode, setRequesterMode] = useState<"pilih" | "manual">(employees.length > 0 ? "pilih" : "manual");
  const [requesterEmployeeId, setRequesterEmployeeId] = useState("");
  const [requesterManualName, setRequesterManualName] = useState("");
  const requesterName = requesterMode === "pilih" ? (employees.find((e) => e.id === requesterEmployeeId)?.name ?? "") : requesterManualName;

  const [departmentMode, setDepartmentMode] = useState<"pilih" | "manual">(siteNames.length > 0 ? "pilih" : "manual");
  const [departmentPicked, setDepartmentPicked] = useState("");
  const [departmentManual, setDepartmentManual] = useState("");
  const department = departmentMode === "pilih" ? departmentPicked : departmentManual;

  const selected = useMemo(() => items.find((i) => i.id === itemId) ?? null, [items, itemId]);
  const total = selected ? selected.price * qty : 0;

  function resetRequesterFields() {
    setRequesterEmployeeId("");
    setRequesterManualName("");
    setDepartmentPicked("");
    setDepartmentManual("");
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await requestItem(formData);
      setOpen(false);
      formRef.current?.reset();
      setItemId("");
      setQty(1);
      resetRequesterFields();
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} disabled={items.length === 0}>
        Ambil barang
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Ambil barang gudang</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="req-itemId">Barang</label>
                <select className="input" id="req-itemId" name="itemId" required value={itemId} onChange={(e) => { setItemId(e.target.value); setError(""); }}>
                  <option value="">Pilih barang…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id} disabled={i.trackStock && i.qty === 0}>
                      {i.trackStock
                        ? `${i.name} — sisa ${i.qty} ${i.unit}${i.qty === 0 ? " (habis)" : ""}`
                        : `${i.name} (beli sesuai permintaan)`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="req-qty">Jumlah</label>
                  <input
                    className="input"
                    id="req-qty"
                    name="qty"
                    type="number"
                    min={1}
                    max={selected?.trackStock ? selected.qty : undefined}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Harga satuan</label>
                  <div className="input" style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>{selected ? formatRp(selected.price) : "-"}</div>
                </div>
              </div>
              {selected && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  Total nilai barang: <strong>{formatRp(total)}</strong> — status awalnya &ldquo;Berjalan&rdquo;, stok &amp; pencatatan ke Kas baru terjadi setelah ditandai &ldquo;Selesai&rdquo;.
                </p>
              )}
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="req-targetDate">Tanggal target selesai (opsional)</label>
                <input className="input" id="req-targetDate" name="targetDate" type="date" />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label htmlFor="req-requesterName" style={{ marginBottom: 0 }}>Nama peminta</label>
                  {employees.length > 0 && (
                    <div className="seg" role="radiogroup">
                      <label className="seg-opt"><input type="radio" checked={requesterMode === "pilih"} onChange={() => setRequesterMode("pilih")} /> Pilih karyawan</label>
                      <label className="seg-opt"><input type="radio" checked={requesterMode === "manual"} onChange={() => setRequesterMode("manual")} /> Isi manual</label>
                    </div>
                  )}
                </div>
                {requesterMode === "pilih" ? (
                  <EmployeeCombobox employees={employees} name="_requesterEmployee" id="req-requesterName" value={requesterEmployeeId} onChange={setRequesterEmployeeId} />
                ) : (
                  <input className="input" id="req-requesterName" value={requesterManualName} onChange={(e) => setRequesterManualName(e.target.value)} placeholder="Nama pemohon" />
                )}
                <input type="hidden" name="requesterName" value={requesterName} />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label htmlFor="req-department" style={{ marginBottom: 0 }}>Tempat kerja/departemen (opsional)</label>
                  {siteNames.length > 0 && (
                    <div className="seg" role="radiogroup">
                      <label className="seg-opt"><input type="radio" checked={departmentMode === "pilih"} onChange={() => setDepartmentMode("pilih")} /> Pilih</label>
                      <label className="seg-opt"><input type="radio" checked={departmentMode === "manual"} onChange={() => setDepartmentMode("manual")} /> Isi manual</label>
                    </div>
                  )}
                </div>
                {departmentMode === "pilih" ? (
                  <select className="input" id="req-department" value={departmentPicked} onChange={(e) => setDepartmentPicked(e.target.value)}>
                    <option value="">Tidak ada</option>
                    {siteNames.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="input" id="req-department" value={departmentManual} onChange={(e) => setDepartmentManual(e.target.value)} placeholder="mis. RS Borromeus" />
                )}
                <input type="hidden" name="department" value={department} />
              </div>

              <div className="field">
                <label htmlFor="req-note">Keterangan (opsional)</label>
                <input className="input" id="req-note" name="note" placeholder="mis. Untuk ruang admin baru" />
              </div>
              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending || !itemId || !requesterName}>{pending ? "Memproses…" : "Ajukan pengambilan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
