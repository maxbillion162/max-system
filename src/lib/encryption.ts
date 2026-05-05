/**
 * Application-layer encryption for sensitive at-rest data.
 *
 * AES-256-GCM with random 96-bit IV per record. Authenticated encryption —
 * any tampering causes decrypt() to fail closed (returns "").
 *
 * Format: `enc:v1:<iv-b64>.<tag-b64>.<ciphertext-b64>`
 *
 * Behavior with no ENCRYPTION_KEY env var: encrypt() passes through plaintext
 * (so dev still works); decrypt() returns plaintext too. This makes the
 * migration safe — turning encryption on does not break legacy plaintext rows.
 */
import crypto from "crypto";

const VERSION = "enc:v1:";

function loadKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  let buf: Buffer;
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    buf = Buffer.from(raw, "hex");
  } else {
    try {
      buf = Buffer.from(raw, "base64");
    } catch {
      throw new Error("ENCRYPTION_KEY must be 64 hex chars or base64-encoded 32 bytes.");
    }
  }
  if (buf.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must decode to 32 bytes, got ${buf.length}.`);
  }
  return buf;
}

const KEY: Buffer | null = loadKey();

export function isEncrypted(s: unknown): s is string {
  return typeof s === "string" && s.startsWith(VERSION);
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  if (typeof plaintext !== "string") return plaintext as unknown as string;
  if (!KEY) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decrypt(s: string | null | undefined): string | null {
  if (s == null) return null;
  if (typeof s !== "string") return s as unknown as string;
  if (!isEncrypted(s)) return s;
  if (!KEY) return "";
  try {
    const payload = s.slice(VERSION.length);
    const parts = payload.split(".");
    if (parts.length !== 3) return "";
    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const ct = Buffer.from(parts[2], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return "";
  }
}

/** Encrypt the named string fields on an object in place (returns a copy). */
export function encryptFields<T extends Record<string, unknown>>(obj: T, fields: readonly (keyof T)[]): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const f of fields) {
    const v = out[f as string];
    if (typeof v === "string") out[f as string] = encrypt(v);
  }
  return out as T;
}

/** Decrypt the named string fields on an object (returns a copy). */
export function decryptFields<T extends Record<string, unknown>>(obj: T, fields: readonly (keyof T)[]): T {
  if (!obj) return obj;
  const out = { ...obj } as Record<string, unknown>;
  for (const f of fields) {
    const v = out[f as string];
    if (typeof v === "string") out[f as string] = decrypt(v);
  }
  return out as T;
}

export const ENCRYPTION_ENABLED = KEY !== null;
