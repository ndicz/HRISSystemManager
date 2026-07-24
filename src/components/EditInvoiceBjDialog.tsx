"use client";

import { useState, useRef } from "react";
import type { InvoiceBj, InvoiceBjItem } from "@prisma/client";
import { updateInvoiceBj } from "@/app/(app)/klien/actions";
import { InvoiceBjFormFields } from "@/components/InvoiceBjFormFields";
import type { ClientOption } from "@/components/ClientCombobox";

type InvoiceRow = InvoiceBj & { items: InvoiceBjItem[] };

export function EditInvoiceBjDialog({ invoice, clients, siteNames }: { invoice: InvoiceRow; clients: ClientOption[]; siteNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateInvoiceBj(invoice.id, formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit invoice {invoice.invoiceNo}</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <InvoiceBjFormFields
                clients={clients}
                siteNames={siteNames}
                defaults={{
                  clientId: invoice.clientId,
                  withPpn: invoice.withPpn,
                  jobTitle: invoice.jobTitle ?? "",
                  discountDesc: invoice.discountDesc ?? "",
                  discountPercent: invoice.discountPercent,
                  signerName: invoice.signerName ?? "",
                  items: invoice.items.map((it) => ({ desc: it.desc, qty: it.qty, price: it.price })),
                }}
              />
              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan perubahan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
