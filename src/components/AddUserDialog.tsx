"use client";

import { useState, useRef } from "react";
import { createUser } from "@/app/(app)/pengguna/actions";
import type { NavItem } from "@/lib/rbac";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  HR: "HR",
  FINANCE: "Finance",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Karyawan",
};

export function AddUserDialog({
  assignableNavItems,
  employeeOptions,
}: {
  assignableNavItems: NavItem[];
  employeeOptions: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("EMPLOYEE");
  const [customAccess, setCustomAccess] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await createUser(formData);
      setOpen(false);
      formRef.current?.reset();
      setRole("EMPLOYEE");
      setCustomAccess(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Tambah pengguna
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Tambah pengguna</div>
            <form ref={formRef} action={handleSubmit} style={{ display: "grid", gap: "var(--space-3)" }}>
              <div className="field">
                <label htmlFor="user-name">Nama</label>
                <input className="input" id="user-name" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="user-username">ID login</label>
                <input className="input" id="user-username" name="username" required placeholder="mis. hrwana1" />
              </div>
              <div className="field">
                <label htmlFor="user-email">Email</label>
                <input className="input" id="user-email" name="email" required placeholder="mis. hrwana@email.com" />
              </div>
              <p style={{ fontSize: 12, opacity: 0.6, margin: 0 }}>ID login maupun email bisa dipakai untuk masuk.</p>
              <div className="field">
                <label htmlFor="user-password">Password</label>
                <input className="input" id="user-password" name="password" type="password" required minLength={6} placeholder="Minimal 6 karakter" />
              </div>
              <div className="field">
                <label htmlFor="user-role">Peran</label>
                <select className="input" id="user-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {employeeOptions.length > 0 && (
                <div className="field">
                  <label htmlFor="user-employee">Kaitkan ke data karyawan (opsional)</label>
                  <select className="input" id="user-employee" name="employeeId" defaultValue="">
                    <option value="">Tidak dikaitkan</option>
                    {employeeOptions.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
                <input type="checkbox" name="customAccess" style={{ width: "auto" }} checked={customAccess} onChange={(e) => setCustomAccess(e.target.checked)} />
                Batasi akses ke halaman tertentu saja (di luar bawaan peran &ldquo;{ROLE_LABEL[role]}&rdquo;)
              </label>

              {customAccess && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Halaman yang boleh dibuka</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-1) var(--space-3)", fontSize: 13 }}>
                    {assignableNavItems.map((item) => (
                      <label key={item.href} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <input type="checkbox" name="pageAccess" value={item.href} style={{ width: "auto" }} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, opacity: 0.6, margin: "var(--space-2) 0 0" }}>Dashboard selalu bisa dibuka. Jika tidak ada yang dicentang, pengguna tidak akan bisa membuka halaman apa pun.</p>
                </div>
              )}

              {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
