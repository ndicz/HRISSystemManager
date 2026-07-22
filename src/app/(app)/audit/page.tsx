import { db } from "@/lib/db";
import { auth } from "@/auth";
import { AuditLogTable } from "@/components/AuditLogTable";
import { ResetDataButton } from "@/components/ResetDataButton";
import { TotpSetupCard } from "@/components/TotpSetupCard";

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
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Audit Log</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Riwayat aktivitas pengguna di sistem &mdash; 300 aktivitas terbaru</p>
      </div>

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
