import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ASSIGNABLE_NAV_ITEMS } from "@/lib/rbac";
import { AddUserDialog } from "@/components/AddUserDialog";
import { EditUserDialog } from "@/components/EditUserDialog";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  HR: "HR",
  FINANCE: "Finance",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Karyawan",
};

export default async function PenggunaPage() {
  const session = await auth();
  const [users, employees] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, include: { employee: { select: { name: true } } } }),
    db.employee.findMany({ where: { status: "aktif" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const linkedEmployeeIds = new Set(users.map((u) => u.employeeId).filter(Boolean));
  const unlinkedEmployees = employees.filter((e) => !linkedEmployeeIds.has(e.id));

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Pengguna</h1>
        <p style={{ margin: "var(--space-1) 0 0", opacity: 0.6 }}>Kelola akun login, peran, dan halaman yang boleh diakses tiap pengguna</p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-3)" }}>
        <AddUserDialog assignableNavItems={ASSIGNABLE_NAV_ITEMS} employeeOptions={unlinkedEmployees} />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>ID login</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Akses halaman</th>
              <th>Karyawan terkait</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === session?.user?.id;
              return (
                <tr key={u.id}>
                  <td>{u.name}{isSelf && <span className="text-muted"> (Anda)</span>}</td>
                  <td className="text-muted">{u.username ?? "-"}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td>
                    {u.pageAccess.length > 0 ? (
                      <span className="tag tag-accent">Kustom: {u.pageAccess.length} halaman</span>
                    ) : (
                      <span className="tag tag-outline">Bawaan peran</span>
                    )}
                  </td>
                  <td className="text-muted">{u.employee?.name ?? "-"}</td>
                  <td>
                    <span className={u.active ? "tag tag-accent" : "tag tag-outline"}>{u.active ? "Aktif" : "Nonaktif"}</span>
                    {u.totpEnabled && <span className="tag tag-outline" style={{ marginLeft: "var(--space-1)" }}>2FA</span>}
                  </td>
                  <td>
                    <EditUserDialog
                      user={{
                        id: u.id,
                        name: u.name,
                        username: u.username,
                        email: u.email,
                        role: u.role,
                        active: u.active,
                        employeeId: u.employeeId,
                        pageAccess: u.pageAccess,
                      }}
                      isSelf={isSelf}
                      assignableNavItems={ASSIGNABLE_NAV_ITEMS}
                      employeeOptions={u.employeeId ? [...unlinkedEmployees, { id: u.employeeId, name: u.employee?.name ?? "" }] : unlinkedEmployees}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
