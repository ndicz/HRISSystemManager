"use client";

import { useState, useTransition } from "react";
import { startTotpSetup, confirmTotpSetup, disableTotp } from "@/app/(app)/audit/actions";

export function TotpSetupCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleStart() {
    setError("");
    startTransition(async () => {
      const data = await startTotpSetup();
      setSetup(data);
    });
  }

  function handleConfirm() {
    setError("");
    startTransition(async () => {
      try {
        await confirmTotpSetup(code);
        setEnabled(true);
        setSetup(null);
        setCode("");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleDisable() {
    setError("");
    startTransition(async () => {
      await disableTotp();
      setEnabled(false);
      setSetup(null);
    });
  }

  return (
    <div className="card">
      <div className="card-kicker">Keamanan Akun</div>
      <div className="card-title" style={{ fontSize: 15 }}>Verifikasi dua langkah (2FA)</div>
      <p className="card-body">
        Setelah aktif, login akun kamu butuh kode 6 digit dari aplikasi authenticator (mis. Google Authenticator,
        Authy) selain username &amp; password.
      </p>

      {enabled ? (
        <>
          <p style={{ fontSize: 13, color: "var(--color-accent-700)", fontWeight: 600 }}>2FA sedang aktif di akun ini.</p>
          <button type="button" className="btn btn-secondary" style={{ width: "fit-content" }} onClick={handleDisable} disabled={pending}>
            {pending ? "Memproses…" : "Nonaktifkan 2FA"}
          </button>
        </>
      ) : setup ? (
        <>
          <p style={{ fontSize: 13 }}>
            Buka aplikasi authenticator, pilih &ldquo;Masukkan kode setup manual&rdquo;, lalu isi:
          </p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Kunci setup</label>
            <input className="input" readOnly value={setup.secret} onFocus={(e) => e.target.select()} style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} />
          </div>
          <p style={{ fontSize: 12, opacity: 0.6 }}>Nama akun: Industri.HR, tipe: Time-based (TOTP).</p>
          <div className="field" style={{ maxWidth: 200, marginBottom: 0 }}>
            <label htmlFor="totp-confirm-code">Kode dari app</label>
            <input
              className="input"
              id="totp-confirm-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
            />
          </div>
          {error && <p style={{ color: "var(--color-accent-800)", fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setSetup(null); setCode(""); setError(""); }} disabled={pending}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={pending || code.length !== 6}>
              {pending ? "Memverifikasi…" : "Aktifkan"}
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-primary" style={{ width: "fit-content" }} onClick={handleStart} disabled={pending}>
          {pending ? "Menyiapkan…" : "Aktifkan 2FA"}
        </button>
      )}
    </div>
  );
}
