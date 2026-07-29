"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { checkCredentials, completeLogin, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(
    (prevState, formData) => (prevState?.step === "code" ? completeLogin(prevState, formData) : checkCredentials(prevState, formData)),
    undefined,
  );

  const isCodeStep = state?.step === "code";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2.5">
        <div
          className="flex size-9 items-center justify-center rounded-lg text-white"
          style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-800))" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <span className="text-base font-semibold">Industri.HR</span>
      </div>

      <h1 className="text-2xl">{isCodeStep ? "Masukkan kode verifikasi" : "Masuk ke akun Anda"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isCodeStep ? "Buka aplikasi authenticator Anda untuk kode 6 digit." : "Sistem HR & Payroll internal PT Wana Samudra Persada."}
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {isCodeStep ? (
          <>
            <input type="hidden" name="challenge" value={state.challenge} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Kode 6 digit</Label>
              <Input
                id="code"
                type="text"
                name="code"
                required
                autoFocus
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                className="text-center text-lg tracking-[0.4em]"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">ID login atau email</Label>
              <Input
                id="email"
                type="text"
                name="email"
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" required />
            </div>
          </>
        )}

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-[var(--color-brand)] text-white hover:bg-[var(--color-accent-600)]"
        >
          {pending ? "Memproses…" : isCodeStep ? "Verifikasi" : "Masuk"}
        </Button>
      </form>
    </div>
  );
}
