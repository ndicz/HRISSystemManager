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
  const accounts = [
    { code: "4001", name: "Dana Klien", type: "masuk" },
    { code: "5001", name: "Gaji Karyawan", type: "keluar", budget: 200000000 },
    { code: "5002", name: "Sewa Tempat", type: "keluar", budget: 40000000 },
    { code: "5003", name: "Utilitas", type: "keluar", budget: 10000000 },
    { code: "5004", name: "Perlengkapan", type: "keluar", budget: 15000000 },
    { code: "5005", name: "Transportasi", type: "keluar", budget: 8000000 },
    { code: "5006", name: "Lain-lain", type: "keluar", budget: 2000000 },
    { code: "5007", name: "Biaya Penugasan Tambahan", type: "keluar" },
    { code: "5008", name: "Beban THR", type: "keluar" },
    { code: "5009", name: "Pembayaran Utang Usaha", type: "keluar" },
    { code: "5010", name: "Bonus/Insentif Karyawan", type: "keluar" },
  ];
  for (const a of accounts) {
    await db.account.upsert({ where: { code: a.code }, update: {}, create: a });
  }

  // --- Cash accounts --------------------------------------------------------
  const cashAccounts = [
    { id: "ca1", name: "Kas Kecil", opening: 10000000 },
    { id: "ca2", name: "Bank BCA — 452xxxxxx1", opening: 200000000 },
    { id: "ca3", name: "Bank Mandiri — 128xxxxxx7", opening: 40000000 },
  ];
  for (const ca of cashAccounts) {
    await db.cashAccount.upsert({ where: { id: ca.id }, update: {}, create: ca });
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
