import type { Account, Transaction } from "@prisma/client";

export function monthKey(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
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
