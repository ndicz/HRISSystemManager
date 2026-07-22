// Hand-rolled TOTP (RFC 6238, built on the HOTP algorithm in RFC 4226) —
// same reasoning as the dependency-free xlsx reader/writer elsewhere in
// this codebase: the algorithm is small, well-specified, and built
// entirely on node:crypto's HMAC, so there's no real benefit to pulling
// in a third-party package for it.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

function base32Encode(buf: Buffer): string {
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    out += BASE32_ALPHABET[parseInt(bits.slice(bits.length - remainder).padEnd(5, "0"), 2)];
  }
  return out;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20)); // 160-bit, the standard TOTP secret size
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

// Accepts a code from one step before/after the current one too, so a
// little clock drift between the phone and the server doesn't lock
// anyone out.
export function verifyTotp(secretBase32: string, token: string): boolean {
  const trimmed = token.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -1; drift <= 1; drift++) {
    const expected = hotp(secret, counter + drift);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(trimmed))) return true;
  }
  return false;
}

export function totpAuthUri(secretBase32: string, accountLabel: string, issuer = "Industri.HR"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

// Short-lived signed token proving "this email's password was already
// verified", so the second (code-entry) step of login never needs the
// plaintext password sent again and doesn't need any server-side session
// storage for the in-between state.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function challengeSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET/NEXTAUTH_SECRET tidak diset.");
  return secret;
}

export function signLoginChallenge(userId: string): string {
  const expires = Date.now() + CHALLENGE_TTL_MS;
  const payload = `${userId}.${expires}`;
  const sig = createHmac("sha256", challengeSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLoginChallenge(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, sig] = parts;
  const payload = `${userId}.${expiresStr}`;
  const expected = createHmac("sha256", challengeSecret()).update(payload).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  if (Date.now() > parseInt(expiresStr, 10)) return null;
  return userId;
}
