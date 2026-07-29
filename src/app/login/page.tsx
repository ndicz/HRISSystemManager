import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="dark grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16 sm:px-10">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1100px 700px at 15% 10%, color-mix(in srgb, var(--color-brand) 35%, transparent), transparent 60%)," +
              "radial-gradient(900px 650px at 90% 90%, color-mix(in srgb, var(--color-cool) 30%, transparent), transparent 55%)," +
              "var(--color-neutral-900)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-12">
          <div
            className="mb-6 flex size-14 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-800))" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <h2 className="max-w-md text-3xl leading-tight text-white">Satu tempat untuk SDM, absensi, dan payroll perusahaan.</h2>
          <p className="mt-3 max-w-sm text-sm text-white/60">
            Industri.HR — sistem internal PT Wana Samudra Persada.
          </p>
        </div>
      </div>
    </div>
  );
}
