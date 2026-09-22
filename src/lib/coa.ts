export type AccountType = "aset" | "kewajiban" | "modal" | "pendapatan" | "beban";

// The standard 5-category chart-of-accounts classification. `base` is the
// first code in that category's thousand-wide range (1000s Aset, 2000s
// Kewajiban, ...) — a full thousand of headroom each so new accounts can
// keep being added under any category without running out of room or
// colliding with another category's numbers. Only pendapatan/beban feed
// Laba Rugi (income statement); aset/kewajiban/modal are balance-sheet
// categories — tracked here for real bookkeeping even though the Neraca
// tab doesn't pull from live COA data yet.
export const ACCOUNT_TYPES: { value: AccountType; label: string; base: number; tagClass: string; hint: string }[] = [
  { value: "aset", label: "Aset", base: 1000, tagClass: "tag-outline", hint: "Yang dimiliki perusahaan — kas & bank, piutang usaha, peralatan." },
  { value: "kewajiban", label: "Kewajiban", base: 2000, tagClass: "tag-danger", hint: "Utang ke pihak luar — utang usaha, pinjaman bank." },
  { value: "modal", label: "Modal", base: 3000, tagClass: "tag-warning", hint: "Ekuitas — modal pemilik, laba ditahan." },
  { value: "pendapatan", label: "Pendapatan", base: 4000, tagClass: "tag-accent", hint: "Uang masuk — dari klien/proyek, pengembalian sisa dana." },
  { value: "beban", label: "Beban", base: 5000, tagClass: "tag-neutral", hint: "Biaya operasional — gaji, sewa, utilitas, dan sejenisnya." },
];

export function accountTypeInfo(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type);
}

export function accountTypeLabel(type: string): string {
  return accountTypeInfo(type)?.label ?? type;
}

export function accountTypeTagClass(type: string): string {
  return accountTypeInfo(type)?.tagClass ?? "tag-neutral";
}

// Suggests the next unused code within the selected type's own range (e.g.
// picking "Beban" with 5001–5006 already taken suggests 5007), so adding an
// account doesn't require knowing or guessing the numbering convention, or
// hunting for a free code by hand — still freely editable, this is just a
// starting point.
export function suggestNextAccountCode(accounts: { code: string }[], type: string): string {
  const info = accountTypeInfo(type);
  if (!info) return "";
  const inRange = accounts
    .map((a) => parseInt(a.code, 10))
    .filter((n) => Number.isFinite(n) && n >= info.base && n < info.base + 1000);
  const max = inRange.length > 0 ? Math.max(...inRange) : info.base - 1;
  return String(max + 1);
}
