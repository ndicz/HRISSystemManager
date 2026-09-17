// In production, Next.js redacts the real message of any error thrown from
// a Server Action/Component — the client only ever sees the generic "An
// error occurred in the Server Components render..." text. The one thing
// that DOES survive is `error.digest`, a short hash that correlates back to
// the real error + stack trace in the server's own logs. Every catch block
// across this app was displaying only `.message`, silently dropping the one
// piece of information that could actually diagnose a production-only
// error — this formats both together so a failure is at least reportable.
export function formatActionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const digest = err instanceof Error && "digest" in err ? String((err as Error & { digest?: string }).digest) : null;
  return digest ? `${message} (kode: ${digest})` : message;
}
