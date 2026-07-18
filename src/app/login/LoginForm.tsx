"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
    >
      <h1 className="mb-1 text-xl font-semibold">Industri.HR</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Masuk ke sistem HR &amp; Payroll internal
      </p>

      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-neutral-600">Username</span>
        <input
          type="text"
          name="email"
          required
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

      {state?.error && (
        <p className="mb-4 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Memproses…" : "Masuk"}
      </button>
    </form>
  );
}
