"use client";

import { useState, useTransition } from "react";
import { resetAllData } from "@/app/(app)/audit/actions";

const CONFIRM_PHRASE = "HAPUS SEMUA DATA";

export function ResetDataButton() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setConfirmText("");
    setError("");
  }

  function handleReset() {
    setError("");
    startTransition(async () => {
      try {
        await resetAllData(confirmText);
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="card" style={{ border: "1px solid #b91c1c", background: "color-mix(in srgb, #b91c1c 6%, var(--color-surface))" }}>
      <div className="card-kicker" style={{ color: "#b91c1c" }}>Zona berbahaya</div>
      <div className="card-title" style={{ fontSize: 15 }}>Reset semua data</div>
      <p className="card-body">
        Menghapus permanen seluruh data karyawan, absensi, gaji, kas &amp; transaksi, klien, tagihan, dan rekrutmen —
        kembali ke kondisi kosong. Akun login (User) tidak ikut terhapus. Tindakan ini tidak bisa dibatalkan.
      </p>
      <button type="button" className="btn" style={{ background: "#b91c1c", color: "#fff", width: "fit-content" }} onClick={() => setOpen(true)}>
        Reset semua data
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <>
                <div className="dialog-title">Selesai</div>
                <p className="dialog-body">Semua data sudah dihapus. Muat ulang halaman untuk melihat perubahannya.</p>
                <div className="dialog-actions">
                  <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                    Muat ulang
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="dialog-title" style={{ color: "#b91c1c" }}>Yakin reset semua data?</div>
                <p className="dialog-body">
                  Ini akan menghapus PERMANEN seluruh data karyawan, absensi, gaji, kas, klien, tagihan, dan rekrutmen.
                  Tidak bisa dibatalkan. Ketik <strong>{CONFIRM_PHRASE}</strong> untuk konfirmasi.
                </p>
                <div className="field" style={{ marginBottom: 0 }}>
                  <input
                    className="input"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    autoFocus
                  />
                </div>
                {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={close} disabled={pending}>
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ background: "#b91c1c", color: "#fff" }}
                    onClick={handleReset}
                    disabled={pending || confirmText !== CONFIRM_PHRASE}
                  >
                    {pending ? "Menghapus…" : "Hapus permanen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
