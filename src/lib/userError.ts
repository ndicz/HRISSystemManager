// A validation/business-rule failure whose message is meant for the person
// using the app ("Posisi dengan nama ini sudah ada", "Periode 2026-10 sudah
// ditutup", …).
//
// In production Next.js replaces the message of anything thrown from a
// Server Action with a generic English sentence; the only field it passes
// through untouched is `digest` (an error that already carries one keeps
// it). So the message rides along in the digest, and formatActionError
// reads it back on the client. Plain `Error`s — unexpected failures, which
// may contain internals — stay redacted as before.
const PREFIX = "pesan:";

export class UserError extends Error {
  digest: string;
  constructor(message: string) {
    super(message);
    this.name = "UserError";
    this.digest = PREFIX + encodeURIComponent(message);
  }
}

export function userErrorMessage(digest: string | null | undefined): string | null {
  if (!digest || !digest.startsWith(PREFIX)) return null;
  try {
    return decodeURIComponent(digest.slice(PREFIX.length));
  } catch {
    return null;
  }
}
