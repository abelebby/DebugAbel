/**
 * Tiny signed-cookie session. Uses Web Crypto so the exact same code runs in
 * the Edge middleware and in Node route handlers.
 *
 * The cookie holds only a display name + expiry. It is HMAC-SHA256 signed with
 * SESSION_SECRET, so a client cannot forge or change it. No secret value is
 * ever placed inside the cookie or returned by any API response.
 */
import { sessionSecret } from "./env";

export const SESSION_COOKIE = "bt_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Session = { name: string; exp: number };

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionCookie(name: string): Promise<string> {
  const payload: Session = {
    name,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), encoder.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function readSessionCookie(value: string | undefined): Promise<Session | null> {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      b64urlDecode(sig),
      encoder.encode(body),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Session;
    if (typeof session.name !== "string" || typeof session.exp !== "number") return null;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
