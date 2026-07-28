import { db } from "@/lib/db";
import { CrmTables } from "@/components/CrmTables";

export default async function CrmPage() {
  const leads = await db.lead.findMany({
    include: { activities: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>CRM</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Pipeline prospek, follow-up, dan konversi jadi klien</p>
      </div>

      <CrmTables leads={leads} />
    </div>
  );
}
