import { db } from "@/lib/db";
import { auth } from "@/auth";
import { MbpPageTabs } from "@/components/MbpPageTabs";
import { MyMbpRequestsPanel } from "@/components/MyMbpRequestsPanel";

export default async function MbpPage() {
  const session = await auth();
  const isEmployeeRole = session?.user?.role === "EMPLOYEE";

  if (isEmployeeRole) {
    const [me, requests, items, sites] = await Promise.all([
      session?.user?.id ? db.user.findUnique({ where: { id: session.user.id }, select: { employee: { select: { name: true } } } }) : null,
      session?.user?.id ? db.mbpRequest.findMany({ where: { createdById: session.user.id }, orderBy: { createdAt: "desc" } }) : [],
      db.inventoryItem.findMany({ where: { active: true, purpose: "mbp" }, select: { id: true, name: true, unit: true, price: true }, orderBy: { name: "asc" } }),
      db.site.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    ]);
    const siteNames = sites.map((s) => s.name);

    return (
      <div>
        <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{ margin: 0 }}>Permintaan Barang</h1>
          <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Ajukan permintaan barang dan pantau status persetujuannya</p>
        </div>
        <MyMbpRequestsPanel requests={requests} items={items} siteNames={siteNames} myName={me?.employee?.name ?? session?.user?.name ?? ""} />
      </div>
    );
  }

  const [requests, mbpsRaw, items, employees, sites, clients] = await Promise.all([
    db.mbpRequest.findMany({ orderBy: { createdAt: "desc" } }),
    db.mbp.findMany({ include: { items: true, client: true }, orderBy: { createdAt: "desc" } }),
    db.inventoryItem.findMany({ where: { active: true, purpose: "mbp" }, select: { id: true, name: true, unit: true, price: true }, orderBy: { name: "asc" } }),
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
