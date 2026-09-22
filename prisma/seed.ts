import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  // --- Admin user ---------------------------------------------------
  // NOTE: "admin"/"admin" is a throwaway credential for local testing
  // only. Must be replaced with a real email + strong password before
  // this ever runs against a production database.
  const adminEmail = "admin";
  const adminPasswordHash = await bcrypt.hash("admin", 10);
  await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: "Administrator",
      role: "ADMIN",
    },
  });

  // --- Site -----------------------------------------------------------
  const site = await db.site.upsert({
    where: { id: "s1" },
    update: {},
    create: {
      id: "s1",
      name: "PT Wana Samudra Persada (Kantor Pusat)",
      address:
        "Jl. Kawaluyaan Indah XVII No.33, Jatisari, Kec. Buahbatu, Kota Bandung, Jawa Barat 40286",
      supervisor: "Fitri Yulyani",
      umr: 4900000,
    },
  });

  // --- Positions --------------------------------------------------------
  const positions = [
    { name: "HR Staff", salaryType: "bulanan", baseSalary: 5600000 },
    { name: "Staff Admin", salaryType: "bulanan", baseSalary: 4950000 },
    { name: "Staff Operasional", salaryType: "bulanan", baseSalary: 4900000 },
    { name: "Kurir", salaryType: "bulanan", baseSalary: 4700000 },
  ];
  for (const p of positions) {
    await db.position.upsert({ where: { name: p.name }, update: {}, create: p });
  }

  // --- Chart of Accounts --------------------------------------------------
  // Standard 5-category classification (see src/lib/coa.ts) — 1000s Aset,
  // 2000s Kewajiban, 3000s Modal, 4000s Pendapatan, 5000s Beban. Only the
  // 4xxx/5xxx accounts are wired to anything (Laba Rugi, Kas transactions,
  // payroll/THR postings); the 1000-3000s below are starter examples so
  // "Tambah akun" has real accounts to look at in each balance-sheet
  // category from day one.
  const accounts = [
    { code: "1000", name: "Kas & Bank", type: "aset" },
    { code: "1001", name: "Piutang Usaha", type: "aset" },
    { code: "1002", name: "Peralatan & Aset Tetap", type: "aset" },
    { code: "2000", name: "Utang Usaha", type: "kewajiban" },
    { code: "2001", name: "Utang Bank/Pinjaman", type: "kewajiban" },
    { code: "3000", name: "Modal Pemilik", type: "modal" },
    { code: "3001", name: "Laba Ditahan", type: "modal" },
    { code: "4001", name: "Dana Klien", type: "pendapatan" },
    { code: "4002", name: "Pengembalian Sisa Project", type: "pendapatan" },
    { code: "4003", name: "Pengembalian Sisa Transportasi", type: "pendapatan" },
    { code: "4004", name: "Pengembalian Lain-lain", type: "pendapatan" },
    { code: "5001", name: "Gaji Karyawan", type: "beban", budget: 200000000 },
    { code: "5002", name: "Sewa Tempat", type: "beban", budget: 40000000 },
    { code: "5003", name: "Utilitas", type: "beban", budget: 10000000 },
    { code: "5004", name: "Perlengkapan", type: "beban", budget: 15000000 },
    { code: "5005", name: "Transportasi", type: "beban", budget: 8000000 },
    { code: "5006", name: "Lain-lain", type: "beban", budget: 2000000 },
    { code: "5007", name: "Biaya Penugasan Tambahan", type: "beban" },
    { code: "5008", name: "Beban THR", type: "beban" },
    { code: "5009", name: "Pembayaran Utang Usaha", type: "beban" },
    { code: "5010", name: "Bonus/Insentif Karyawan", type: "beban" },
    { code: "5011", name: "Pengeluaran Barang Gudang", type: "beban" },
  ];
  for (const a of accounts) {
    await db.account.upsert({ where: { code: a.code }, update: {}, create: a });
  }

  // --- Cash accounts --------------------------------------------------------
  const cashAccounts = [
    { id: "ca1", name: "Kas Kecil", opening: 10000000, kind: "kecil" },
    { id: "ca2", name: "Bank BCA — 452xxxxxx1", opening: 200000000, kind: "besar" },
    { id: "ca3", name: "Bank Mandiri — 128xxxxxx7", opening: 40000000, kind: "besar" },
  ];
  for (const ca of cashAccounts) {
    await db.cashAccount.upsert({ where: { id: ca.id }, update: { kind: ca.kind }, create: ca });
  }

  console.log("Seed selesai.");
  console.log(`Login admin awal: ${adminEmail} / admin`);
  console.log("PENTING: ini kredensial testing, ganti sebelum produksi.");
  console.log(`Site siap dipakai: ${site.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
