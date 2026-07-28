import { db } from "@/lib/db";
import { CrmTables } from "@/components/CrmTables";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function CrmPage() {
  const leads = await db.lead.findMany({
    include: { activities: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/crm"]} title="CRM" subtitle="Pipeline prospek, follow-up, dan konversi jadi klien" />

      <CrmTables leads={leads} />
    </div>
  );
}
