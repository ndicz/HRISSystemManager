"use client";

import { useState, useRef } from "react";
import { addInvoiceBj } from "@/app/(app)/klien/actions";
import { InvoiceBjFormFields } from "@/components/InvoiceBjFormFields";
import type { ClientOption } from "@/components/ClientCombobox";

export function AddInvoiceBjDialog({ clients, siteNames }: { clients: ClientOption[]; siteNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await addInvoiceBj(formData);
      setOpen(false);
      formRef.current?.reset();
      setFormKey((k) => k + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Buat invoice baru</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Buat invoice barang &amp; jasa</div>
            <form key={formKey} ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <InvoiceBjFormFields clients={clients} siteNames={siteNames} />
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Buat invoice"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
