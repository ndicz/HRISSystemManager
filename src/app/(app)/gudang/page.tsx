import { db } from "@/lib/db";
import { GudangTables } from "@/components/GudangTables";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function GudangPage() {
  const [items, requests, employees, sites] = await Promise.all([
    db.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    db.inventoryRequest.findMany({ orderBy: { date: "desc" } }),
    db.employee.findMany({ where: { status: "aktif" }, select: { id: true, name: true, empCode: true }, orderBy: { name: "asc" } }),
    db.site.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const siteNames = sites.map((s) => s.name);

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/gudang"]} title="Gudang" subtitle="Stok barang, pengambilan barang, dan pencatatan otomatis ke Kas" />

      <GudangTables items={items} requests={requests} employees={employees} siteNames={siteNames} />
    </div>
  );
}
