"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { checkCredentials, completeLogin, type LoginState } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [state, formAction, pending] = useActionState<LoginState | undefined, FormData>(
    (prevState, formData) => (prevState?.step === "code" ? completeLogin(prevState, formData) : checkCredentials(prevState, formData)),
    undefined,
  );

  const isCodeStep = state?.step === "code";

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
    >
      <h1 className="mb-1 text-xl font-semibold">Industri.HR</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {isCodeStep ? "Masukkan kode dari aplikasi authenticator Anda" : "Masuk ke sistem HR & Payroll internal"}
      </p>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {isCodeStep ? (
        <>
          <input type="hidden" name="challenge" value={state.challenge} />
          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-neutral-600">Kode 6 digit</span>
            <input
              type="text"
              name="code"
              required
              autoFocus
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-neutral-500"
            />
          </label>
        </>
      ) : (
        <>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-neutral-600">ID login atau email</span>
            <input
              type="text"
              name="email"
              required
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-neutral-600">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>
        </>
      )}

      {state?.error && (
        <p className="mb-4 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Memproses…" : isCodeStep ? "Verifikasi" : "Masuk"}
      </button>
    </form>
  );
}
