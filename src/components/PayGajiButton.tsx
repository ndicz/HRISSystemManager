"use client";

import { useState, useTransition } from "react";
import { bayarGaji } from "@/app/(app)/penggajian/actions";
import { formatRp } from "@/lib/payroll";
import { formatActionError } from "@/lib/errors";

export function PayGajiButton({
  employeeIds,
  period,
  label,
  totalAmount,
  onPaid,
}: {
  employeeIds: string[];
  period: string;
  label: string;
  totalAmount: number;
  onPaid?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ paid: number; skipped: number; total: number; failed: { name: string; reason: string }[] } | null>(null);
  const [error, setError] = useState("");

  function confirm() {
    setError("");
    startTransition(async () => {
      try {
        const res = await bayarGaji(employeeIds, period);
        setResult(res);
        onPaid?.();
      } catch (err) {
        setError(formatActionError(err));
      }
    });
  }

  function close() {
    setOpen(false);
    setResult(null);
    setError("");
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)} disabled={employeeIds.length === 0}>
        {label}
      </button>
      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Bayar Gaji</div>
            <div className="dialog-body">
              {!result ? (
                <>
                  <p style={{ marginTop: 0 }}>
                    Membayar gaji {employeeIds.length} karyawan untuk periode {period}, total {formatRp(totalAmount)}.
                    Ini akan mencatat transaksi pengeluaran ke Kas (COA Gaji Karyawan). Karyawan yang sudah dibayar untuk periode ini otomatis dilewati.
                  </p>
                  {error && <p style={{ color: "var(--color-danger)", fontSize: 13 }}>{error}</p>}
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0 }}>
                    {result.paid} karyawan dibayar (total {formatRp(result.total)})
                    {result.skipped > 0 ? `, ${result.skipped} sudah dibayar sebelumnya (dilewati)` : ""}
                    {result.failed.length > 0 ? `, ${result.failed.length} gagal` : ""}.
                  </p>
                  {result.failed.length > 0 && (
                    <div style={{ fontSize: 13, color: "var(--color-danger)" }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Gagal dibayar:</p>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {result.failed.map((f, i) => (
                          <li key={i}>{f.name} — {f.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={close}>
                {result ? "Tutup" : "Batal"}
              </button>
              {!result && (
                <button type="button" className="btn btn-primary" disabled={pending} onClick={confirm}>
                  {pending ? "Memproses…" : "Bayar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
