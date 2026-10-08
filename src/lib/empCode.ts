import { db } from "@/lib/db";

// "WSP" + running number + bulan masuk + tahun masuk (2 digit), e.g.
// "WSP 0011026" = no. urut 001, masuk Oktober 2026. The running number
// continues from the highest one in use — not from the employee count,
// which drops when someone is deleted and then handed out a number that was
// already taken (resigned employees stay in the table, so their numbers are
// never handed out again).
export async function nextEmpCode(hireDate: Date): Promise<string> {
  const rows = await db.employee.findMany({ where: { empCode: { startsWith: "WSP " } }, select: { empCode: true } });
  let maxUrut = 0;
  for (const { empCode } of rows) {
    const m = /^WSP (\d+)\d{4}$/.exec(empCode);
    if (m) maxUrut = Math.max(maxUrut, parseInt(m[1], 10));
  }
  // Codes in another format (e.g. typed by hand) still count toward the
  // total, so the number never falls below what the old count+1 gave.
  const total = await db.employee.count();
  const urut = String(Math.max(maxUrut, total) + 1).padStart(3, "0");
  const mm = String(hireDate.getMonth() + 1).padStart(2, "0");
  const yy = String(hireDate.getFullYear() % 100).padStart(2, "0");
  return "WSP " + urut + mm + yy;
}

export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}
