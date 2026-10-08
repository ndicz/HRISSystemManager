import { db } from "@/lib/db";

// Running numbers on documents ("0007-INV-WSP-1026", "OS-202610-0012",
// "0003-MBP-WSP-1026") continue from the highest one in use. They used to be
// count + 1, which hands out an existing number as soon as any document is
// deleted (draft invoices can be) — and invoiceNo/mbpNo are unique, so
// saving simply failed from then on.
function maxSeq(values: string[], pattern: RegExp): number {
  let max = 0;
  for (const v of values) {
    const m = pattern.exec(v);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function mmYY(d = new Date()) {
  return String(d.getMonth() + 1).padStart(2, "0") + String(d.getFullYear()).slice(-2);
}

export async function nextInvoiceBjNo(): Promise<string> {
  const rows = await db.invoiceBj.findMany({ select: { invoiceNo: true } });
  const seq = Math.max(maxSeq(rows.map((r) => r.invoiceNo), /^(\d+)-INV-/), rows.length) + 1;
  return `${String(seq).padStart(4, "0")}-INV-WSP-${mmYY()}`;
}

export async function nextMbpNo(): Promise<string> {
  const rows = await db.mbp.findMany({ select: { mbpNo: true } });
  const seq = Math.max(maxSeq(rows.map((r) => r.mbpNo), /^(\d+)-MBP-/), rows.length) + 1;
  return `${String(seq).padStart(4, "0")}-MBP-WSP-${mmYY()}`;
}

// Highest running number used so far by outsourcing invoices; the caller
// adds 1 for each invoice it creates in one generate run.
export async function lastOutsourcingInvoiceSeq(): Promise<number> {
  const rows = await db.invoice.findMany({ select: { invoiceNo: true } });
  return Math.max(maxSeq(rows.map((r) => r.invoiceNo), /^OS-\d{6}-(\d+)$/), rows.length);
}

// Two people saving at the same moment can still pick the same next number;
// the unique index rejects the second one, so take a fresh number and retry.
export async function retryOnDuplicateNumber<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002" || i >= attempts - 1) throw err;
    }
  }
}
