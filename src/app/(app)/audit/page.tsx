import { db } from "@/lib/db";
import { auth } from "@/auth";
import { AuditLogTable } from "@/components/AuditLogTable";
import { ResetDataButton } from "@/components/ResetDataButton";
import { TotpSetupCard } from "@/components/TotpSetupCard";
import { PageHeader } from "@/components/PageHeader";
import { NAV_ICONS } from "@/components/NavIcons";

export default async function AuditPage() {
  const session = await auth();
  const [logs, currentUser] = await Promise.all([
    db.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    session?.user ? db.user.findUnique({ where: { id: session.user.id }, select: { totpEnabled: true } }) : null,
  ]);

  const rows = logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    userName: l.user ? l.user.name : "Sistem",
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    detail: l.detail,
  }));

  return (
    <div>
      <PageHeader icon={NAV_ICONS["/audit"]} title="Audit Log" subtitle="Riwayat aktivitas pengguna di sistem — 300 aktivitas terbaru" />

      <AuditLogTable rows={rows} />

      <div style={{ marginTop: "var(--space-6)" }}>
        <TotpSetupCard initialEnabled={currentUser?.totpEnabled ?? false} />
      </div>

      <div style={{ marginTop: "var(--space-6)" }}>
        <ResetDataButton />
      </div>
    </div>
  );
}
