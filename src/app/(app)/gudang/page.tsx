import { db } from "@/lib/db";
import { GudangTables } from "@/components/GudangTables";

export default async function GudangPage() {
  const [items, requests] = await Promise.all([
    db.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    db.inventoryRequest.findMany({ orderBy: { date: "desc" } }),
  ]);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Gudang</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Stok barang, pengambilan barang, dan pencatatan otomatis ke Kas</p>
      </div>

      <GudangTables items={items} requests={requests} />
    </div>
  );
}
