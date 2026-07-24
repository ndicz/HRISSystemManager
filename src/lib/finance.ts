import type { Account, Client, Invoice, InvoiceBj, InvoiceBjItem, Transaction } from "@prisma/client";

export function monthKey(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// ── Invoice Barang & Jasa totals ────────────────────────────────────────

export function invoiceBjSubtotal(items: { qty: number; price: number }[]): number {
  return items.reduce((s, it) => s + it.qty * it.price, 0);
}

export function invoiceBjDiscountValue(items: { qty: number; price: number }[], discountPercent: number): number {
  return Math.round(invoiceBjSubtotal(items) * (discountPercent / 100));
}

export function invoiceBjTotal(items: { qty: number; price: number }[], discountPercent: number, withPpn: boolean): number {
  const afterDiscount = invoiceBjSubtotal(items) - invoiceBjDiscountValue(items, discountPercent);
  return withPpn ? Math.round(afterDiscount * 1.11) : afterDiscount;
}

// ── Aging piutang, shared by /klien (full breakdown) and /kas (total card) ─

type InvoiceBjAging = InvoiceBj & { client: Client; items: InvoiceBjItem[] };
type InvoiceAging = Invoice & { client: Client };

export const AGING_BUCKET_ORDER = ["Belum jatuh tempo", "1-30 hari", "31-60 hari", "61-90 hari", ">90 hari"];

export function agingBucket(dueDate: Date, ref: Date): string {
  const days = Math.floor((ref.getTime() - dueDate.getTime()) / 86400000);
  if (days <= 0) return "Belum jatuh tempo";
  if (days <= 30) return "1-30 hari";
  if (days <= 60) return "31-60 hari";
  if (days <= 90) return "61-90 hari";
  return ">90 hari";
}

export type AgingRow = { id: string; type: "bj" | "outsourcing"; name: string; source: string; dueDate: Date; docHandoverDate: Date | null; amount: number; bucket: string };

export function computeAgingRows(invoicesBj: InvoiceBjAging[], invoices: InvoiceAging[], now: Date): AgingRow[] {
  const rows: AgingRow[] = [];

  for (const inv of invoicesBj) {
    if (inv.status === "lunas" || inv.status === "dibatalkan") continue;
    rows.push({
      id: inv.id,
      type: "bj",
      name: inv.client.name + " — " + inv.invoiceNo,
      source: "Barang & Jasa",
      dueDate: inv.dueDate,
      docHandoverDate: inv.docHandoverDate,
      amount: invoiceBjTotal(inv.items, inv.discountPercent, inv.withPpn),
      bucket: agingBucket(inv.dueDate, now),
    });
  }
  for (const inv of invoices) {
    if (inv.status === "lunas" || inv.status === "dibatalkan" || !inv.dueDate) continue;
    rows.push({
      id: inv.id,
      type: "outsourcing",
      name: inv.client.name + " — " + inv.invoiceNo,
      source: "Outsourcing",
      dueDate: inv.dueDate,
      docHandoverDate: inv.docHandoverDate,
      amount: inv.total,
      bucket: agingBucket(inv.dueDate, now),
    });
  }

  rows.sort((a, b) => AGING_BUCKET_ORDER.indexOf(a.bucket) - AGING_BUCKET_ORDER.indexOf(b.bucket));
  return rows;
}

// ── Terbilang: converts a Rupiah amount to Indonesian words, for printed
// invoices (e.g. "Lima juta rupiah") ────────────────────────────────────

const ONES = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

function spellBelowThousand(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return (n === 10 ? "sepuluh" : n === 11 ? "sebelas" : ONES[n - 10] + " belas");
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    return (tens === 1 ? "sepuluh" : ONES[tens] + " puluh") + (rest ? " " + ONES[rest] : "");
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return (hundreds === 1 ? "seratus" : ONES[hundreds] + " ratus") + (rest ? " " + spellBelowThousand(rest) : "");
}

function spellInteger(n: number): string {
  if (n === 0) return "nol";
  const groups: [number, string][] = [
    [1_000_000_000_000, "triliun"],
    [1_000_000_000, "miliar"],
    [1_000_000, "juta"],
    [1_000, "ribu"],
  ];
  let remaining = n;
  const parts: string[] = [];
  for (const [value, label] of groups) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      // "seribu", not "satu ribu"
      parts.push((value === 1_000 && count === 1 ? "se" : spellBelowThousand(count) + " ") + label);
      remaining -= count * value;
    }
  }
  if (remaining > 0) parts.push(spellBelowThousand(remaining));
  return parts.join(" ").trim();
}

export function terbilang(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const words = spellInteger(n);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return (amount < 0 ? "Minus " + capitalized : capitalized) + " rupiah";
}

export function laporanLabaRugi(accounts: Account[], transactions: Transaction[], period: string) {
  const inPeriod = transactions.filter((t) => monthKey(t.date) === period && !t.isTransfer);

  const pendapatanRows = accounts
    .filter((a) => a.type === "masuk")
    .map((a) => {
      const amt = inPeriod.filter((t) => t.accountCoaId === a.id && t.type === "masuk").reduce((s, t) => s + t.amount, 0);
      return { account: a, amt };
    });
  const bebanRows = accounts
    .filter((a) => a.type === "keluar")
    .map((a) => {
      const amt = inPeriod.filter((t) => t.accountCoaId === a.id && t.type === "keluar").reduce((s, t) => s + t.amount, 0);
      return { account: a, amt };
    });

  const totalPendapatan = pendapatanRows.reduce((s, r) => s + r.amt, 0);
  const totalBeban = bebanRows.reduce((s, r) => s + r.amt, 0);
  return { pendapatanRows, bebanRows, totalPendapatan, totalBeban, labaRugi: totalPendapatan - totalBeban };
}

export function saldoKasSampai(openingTotal: number, transactions: Transaction[], period: string) {
  return (
    openingTotal +
    transactions
      .filter((t) => monthKey(t.date) <= period)
      .reduce((s, t) => s + (t.type === "masuk" ? t.amount : -t.amount), 0)
  );
}

export function saldoKasSebelum(openingTotal: number, transactions: Transaction[], period: string) {
  return (
    openingTotal +
    transactions
      .filter((t) => monthKey(t.date) < period)
      .reduce((s, t) => s + (t.type === "masuk" ? t.amount : -t.amount), 0)
  );
}
