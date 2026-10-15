"use client";

import { reactivateEmployee } from "@/app/(app)/karyawan/actions";
import { useActionRunner } from "@/lib/useActionRunner";

export function ReactivateEmployeeButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const { pending, error, run } = useActionRunner();
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Aktifkan kembali "${employeeName}"? Data resign-nya dihapus dan karyawan ini muncul lagi di Absensi & Penggajian. Riwayat lamanya tetap utuh.`)) return;
          run(() => reactivateEmployee(employeeId));
        }}
      >
        {pending ? "…" : "Aktifkan kembali"}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--color-danger)" }}>{error}</span>}
    </>
  );
}
