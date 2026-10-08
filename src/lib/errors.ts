import { userErrorMessage } from "@/lib/userError";

// In production, Next.js redacts the real message of any error thrown from
// a Server Action/Component — the client only ever sees the generic "An
// error occurred in the Server Components render..." text. The one thing
// that DOES survive is `error.digest`. A UserError (lib/userError.ts) puts
// its readable message there, so that's shown as-is; anything else is an
// unexpected failure, shown with its digest — a short hash that correlates
// back to the real error + stack trace in the server's own logs.
export function formatActionError(err: unknown): string {
  const digest = err instanceof Error && "digest" in err ? String((err as Error & { digest?: string }).digest) : null;
  const userMessage = userErrorMessage(digest);
  if (userMessage) return userMessage;
  const message = err instanceof Error ? err.message : String(err);
  return digest ? `${message} (kode: ${digest})` : message;
}
