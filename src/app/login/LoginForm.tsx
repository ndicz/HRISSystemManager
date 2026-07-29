"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { checkCredentials, completeLogin, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Industri.HR</CardTitle>
        <CardDescription>
          {isCodeStep ? "Masukkan kode dari aplikasi authenticator Anda" : "Masuk ke sistem HR & Payroll internal"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
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

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Memproses…" : isCodeStep ? "Verifikasi" : "Masuk"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
