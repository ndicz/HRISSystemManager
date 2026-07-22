// Builds the "Data" sheet of BCA's Multi Payroll bulk-transfer upload
// template (columns/limits per that template's own Legend sheet): No,
// Transaction ID (unique, <=18 chars), Transfer Type (<=3 chars — "BCA" for
// same-bank transfers, "LLG" interbank), Beneficiary ID (Designated Account
// only, unused here), Credited Account, Receiver Name, Amount, NIP,
// Remark (<=18 chars), Beneficiary email, Receiver Swift Code, Receiver
// Cust Type ("1" = perorangan/individual), Receiver Cust Residence
// ("1" = resident) — the last two are fixed for a payroll-to-employees run.

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export type BankTransferInput = {
  empCode: string;
  name: string;
  bankName: string | null;
  bankAccount: string | null;
  amount: number;
};

// Transaction IDs must be unique for ~3 months per the bank template's own
// rule — DDMM + a zero-padded per-export sequence keeps every row within
// one export unique and matches the day the file is actually generated.
function transactionId(seq: number, generatedAt: Date): string {
  const dd = String(generatedAt.getDate()).padStart(2, "0");
  const mm = String(generatedAt.getMonth() + 1).padStart(2, "0");
  return dd + mm + String(seq).padStart(3, "0");
}

export function buildBcaTransferSheet(rows: BankTransferInput[], period: string, generatedAt: Date = new Date()): (string | number)[][] {
  const [, monthStr] = period.split("-");
  const monthName = MONTH_NAMES[(parseInt(monthStr, 10) || 1) - 1];
  const remark = ("PAYROLL " + monthName.toUpperCase()).slice(0, 18);

  const header = [
    "No", "Transaction ID", "Transfer Type", "Beneficiary ID", "Credited Account",
    "Receiver Name", "Amount", "NIP", "Remark", "Beneficiary email address",
    "Receiver Swift Code", "Receiver Cust Type", "Receiver Cust Residence",
  ];

  const dataRows = rows.map((r, i) => [
    i + 1,
    transactionId(i + 1, generatedAt),
    r.bankName?.trim().toUpperCase() === "BCA" ? "BCA" : "LLG",
    "",
    r.bankAccount ?? "",
    r.name,
    Math.round(r.amount),
    r.empCode,
    remark,
    "",
    "",
    "1",
    "1",
  ]);

  return [header, ...dataRows];
}
