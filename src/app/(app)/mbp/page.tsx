import { db } from "@/lib/db";
import { MbpPageTabs } from "@/components/MbpPageTabs";

export default async function MbpPage() {
  const [requests, mbpsRaw, items, employees, sites, clients] = await Promise.all([
    db.mbpRequest.findMany({ orderBy: { createdAt: "desc" } }),
    db.mbp.findMany({ include: { items: true, client: true }, orderBy: { createdAt: "desc" } }),
    db.inventoryItem.findMany({ where: { active: true }, select: { id: true, name: true, unit: true, price: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { status: "aktif" }, select: { id: true, name: true, empCode: true }, orderBy: { name: "asc" } }),
    db.site.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const siteNames = sites.map((s) => s.name);
  const mbps = mbpsRaw.map((m) => ({
    id: m.id,
    mbpNo: m.mbpNo,
    clientName: m.client?.name ?? m.clientNameManual ?? "-",
    date: m.date,
    jobTitle: m.jobTitle,
    status: m.status,
    invoiceBjId: m.invoiceBjId,
    items: m.items,
  }));

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>MBP</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Material Budget Plan — permintaan barang lapangan, persetujuan, dan penawaran ke klien</p>
      </div>

      <MbpPageTabs requests={requests} mbps={mbps} items={items} employees={employees} siteNames={siteNames} clients={clients} />
    </div>
  );
}
