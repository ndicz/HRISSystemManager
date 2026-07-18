"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { computeThr } from "@/lib/payroll";

export async function bayarThr(employeeId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const emp = await db.employee.findUnique({ where: { id: employeeId }, include: { salaryComponents: true } });
  if (!emp || emp.thrPaid) return;

  const { thr } = computeThr(emp, emp.salaryComponents);
  const account = await db.account.findFirst({ where: { code: "5008" } });
  const cashAccount = await db.cashAccount.findFirst();

  if (account && cashAccount) {
    await db.transaction.create({
      data: {
        date: new Date(),
        accountCoaId: account.id,
        cashAccountId: cashAccount.id,
        desc: "Pembayaran THR — " + emp.name,
        amount: thr,
        type: "keluar",
      },
    });
  }

  await db.employee.update({ where: { id: employeeId }, data: { thrPaid: true } });
  await db.auditLog.create({ data: { userId: session.user.id, action: "thr.pay", entity: "Employee", entityId: employeeId } });

  revalidatePath("/penggajian");
  revalidatePath("/kas");
}
