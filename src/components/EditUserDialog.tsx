"use client";

import { useState } from "react";
import { updateUser, resetUserPassword, deleteUser } from "@/app/(app)/pengguna/actions";
import type { NavItem } from "@/lib/rbac";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  HR: "HR",
  FINANCE: "Finance",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Karyawan",
};

type UserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string;
  active: boolean;
  employeeId: string | null;
  pageAccess: string[];
};

export function EditUserDialog({
  user,
  isSelf,
  assignableNavItems,
  employeeOptions,
}: {
  user: UserRow;
  isSelf: boolean;
  assignableNavItems: NavItem[];
  employeeOptions: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [customAccess, setCustomAccess] = useState(user.pageAccess.length > 0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwPending, setPwPending] = useState(false);

  const [delError, setDelError] = useState("");
  const [delPending, setDelPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await updateUser(formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  async function handleResetPassword(formData: FormData) {
    setPwPending(true);
    setPwError("");
    try {
      await resetUserPassword(formData);
      setPwOpen(false);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : String(err));
    } finally {
      setPwPending(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Hapus akun "${user.name}" (${user.email}) secara permanen? Aksi ini tidak bisa dibatalkan.`)) return;
    setDelPending(true);
    setDelError("");
    try {
      const formData = new FormData();
      formData.set("userId", user.id);
      await deleteUser(formData);
      setOpen(false);
    } catch (err) {
      setDelError(err instanceof Error ? err.message : String(err));
    } finally {
      setDelPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Edit pengguna &mdash; {user.name}</div>
            <form action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <input type="hidden" name="userId" value={user.id} />
              <div className="field">
                <label htmlFor={`edit-name-${user.id}`}>Nama</label>
                <input className="input" id={`edit-name-${user.id}`} name="name" defaultValue={user.name} required />
              </div>
              <div className="field">
                <label htmlFor={`edit-username-${user.id}`}>ID login</label>
                <input className="input" id={`edit-username-${user.id}`} name="username" defaultValue={user.username ?? ""} required placeholder="mis. hrwana1" />
              </div>
              <div className="field">
                <label htmlFor={`edit-email-${user.id}`}>Email</label>
                <input className="input" id={`edit-email-${user.id}`} name="email" defaultValue={user.email} required />
              </div>
              <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>ID login maupun email bisa dipakai untuk masuk.</p>
              <div className="field">
                <label htmlFor={`edit-role-${user.id}`}>Peran</label>
                <select className="input" id={`edit-role-${user.id}`} name="role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {isSelf && <p style={{ fontSize: 12, opacity: 0.6, margin: "var(--space-1) 0 0" }}>Tidak bisa mengubah peran akun sendiri.</p>}
              </div>
              {employeeOptions.length > 0 && (
                <div className="field">
                  <label htmlFor={`edit-employee-${user.id}`}>Kaitkan ke data karyawan</label>
                  <select className="input" id={`edit-employee-${user.id}`} name="employeeId" defaultValue={user.employeeId ?? ""}>
                    <option value="">Tidak dikaitkan</option>
                    {employeeOptions.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
                <input type="checkbox" name="active" defaultChecked={user.active} style={{ width: "auto" }} disabled={isSelf} />
                Akun aktif (bisa login)
              </label>
              {isSelf && <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>Tidak bisa menonaktifkan akun sendiri.</p>}

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
                <input type="checkbox" name="customAccess" style={{ width: "auto" }} checked={customAccess} onChange={(e) => setCustomAccess(e.target.checked)} />
                Batasi akses ke halaman tertentu saja (di luar bawaan peran)
              </label>

              {customAccess && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Halaman yang boleh dibuka</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-1) var(--space-3)", fontSize: 13 }}>
                    {assignableNavItems.map((item) => (
                      <label key={item.href} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <input type="checkbox" name="pageAccess" value={item.href} defaultChecked={user.pageAccess.includes(item.href)} style={{ width: "auto" }} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.6, margin: "var(--space-2) 0 0" }}>Dashboard selalu bisa dibuka. Jika tidak ada yang dicentang, pengguna tidak akan bisa membuka halaman apa pun.</p>
                </div>
              )}

              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions" style={{ justifyContent: "space-between" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPwOpen((v) => !v)}>
                  {pwOpen ? "Batal reset password" : "Reset password"}
                </button>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                    Tutup
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={pending}>
                    {pending ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </div>
            </form>

            {!isSelf && (
              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-neutral-200)" }}>
                {delError && <p style={{ color: "#b91c1c", fontSize: 13, margin: "0 0 var(--space-2)" }}>{delError}</p>}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: "#b91c1c", borderColor: "#b91c1c" }}
                  onClick={handleDelete}
                  disabled={delPending}
                >
                  {delPending ? "Menghapus…" : "Hapus akun permanen"}
                </button>
              </div>
            )}

            {pwOpen && (
              <form action={handleResetPassword} style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-neutral-200)" }}>
                <input type="hidden" name="userId" value={user.id} />
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor={`pw-${user.id}`}>Password baru</label>
                  <input className="input" id={`pw-${user.id}`} name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" />
                </div>
                {pwError && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{pwError}</p>}
                <button type="submit" className="btn btn-primary" style={{ width: "fit-content" }} disabled={pwPending}>
                  {pwPending ? "Menyimpan…" : "Simpan password baru"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
