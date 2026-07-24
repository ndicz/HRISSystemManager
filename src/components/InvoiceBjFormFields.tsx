"use client";

import { useState } from "react";
import { ClientCombobox, type ClientOption } from "@/components/ClientCombobox";
import { RupiahInput } from "@/components/RupiahInput";

let nextRowId = 1;

export type InvoiceBjFormDefaults = {
  clientId?: string;
  withPpn?: boolean;
  jobTitle?: string;
  discountDesc?: string;
  discountPercent?: number;
  signerName?: string;
  items?: { desc: string; qty: number; price: number }[];
};

// Shared field set for both AddInvoiceBjDialog and EditInvoiceBjDialog —
// same form, either starting blank or pre-filled from an existing invoice.
export function InvoiceBjFormFields({
  clients,
  siteNames,
  defaults,
}: {
  clients: ClientOption[];
  siteNames: string[];
  defaults?: InvoiceBjFormDefaults;
}) {
  const [clientId, setClientId] = useState(defaults?.clientId ?? "");
  const initialItems = defaults?.items && defaults.items.length > 0 ? defaults.items : [{ desc: "", qty: 1, price: 0 }];
  const [rowIds, setRowIds] = useState<number[]>(() => initialItems.map(() => nextRowId++));

  function addRow() {
    setRowIds((prev) => [...prev, nextRowId++]);
  }

  function removeRow(id: number) {
    setRowIds((prev) => prev.filter((r) => r !== id));
  }

  return (
    <>
      <div className="field">
        <label htmlFor="clientId">Klien</label>
        <ClientCombobox clients={clients} siteNames={siteNames} name="clientId" id="clientId" value={clientId} onChange={(id) => setClientId(id)} />
      </div>
      <label className="field" style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row" }}>
        <input type="checkbox" name="withPpn" defaultChecked={defaults?.withPpn ?? true} style={{ width: "auto" }} />
        <span>Kena PPN 11%</span>
      </label>
      <div className="field">
        <label htmlFor="jobTitle">Nama pekerjaan (opsional)</label>
        <input className="input" id="jobTitle" name="jobTitle" defaultValue={defaults?.jobTitle ?? ""} placeholder="mis. Jasa Pengadaan Alat Kantor" />
      </div>
      <div className="field" style={{ marginBottom: 0 }}><label>Item</label></div>
      {rowIds.map((rowId, idx) => {
        const i = idx + 1;
        const it = initialItems[idx];
        return (
          <div key={rowId} className="grid-cols" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "var(--space-2)", alignItems: "center" }}>
            <input className="input" name={`desc${i}`} defaultValue={it?.desc ?? ""} placeholder={i === 1 ? "Nama item/jasa" : `Item ke-${i} (opsional)`} />
            <input className="input" name={`qty${i}`} type="number" defaultValue={it?.qty ?? undefined} placeholder="Qty" />
            <RupiahInput name={`price${i}`} defaultValue={it?.price} placeholder="Harga satuan" />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => removeRow(rowId)}
              disabled={rowIds.length <= 1}
              title="Hapus item"
            >
              &times;
            </button>
          </div>
        );
      })}
      <button type="button" className="btn btn-secondary" onClick={addRow} style={{ width: "fit-content" }}>
        + Tambah item
      </button>
      <div className="grid-cols" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-2)" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="discountDesc">Keterangan diskon (opsional)</label>
          <input className="input" id="discountDesc" name="discountDesc" defaultValue={defaults?.discountDesc ?? ""} placeholder="mis. Diskon pelanggan lama" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="discountPercent">Diskon (%)</label>
          <input className="input" id="discountPercent" name="discountPercent" type="number" min={0} max={100} defaultValue={defaults?.discountPercent || ""} placeholder="0" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="signerName">Nama penandatangan (opsional)</label>
        <input className="input" id="signerName" name="signerName" defaultValue={defaults?.signerName ?? ""} placeholder="mis. Budi Santoso, Direktur" />
      </div>
    </>
  );
}
