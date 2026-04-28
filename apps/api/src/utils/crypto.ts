/**
 * Simple symmetric encryption for secrets at rest using AES-256-GCM.
 * Key is read from CAPDOWN_SECRET_KEY env var (32 bytes hex = 64 chars).
 * Falls back to a deterministic dev key when the env var is absent.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.CAPDOWN_SECRET_KEY;
  if (hex && hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }
  // Dev fallback — NOT safe for production; warns loudly.
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[crypto] CAPDOWN_SECRET_KEY not set or invalid. Using dev fallback key — DO NOT use in production!'
    );
  }
  return Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
}

/** Encrypts a plaintext string and returns a base64 blob: `iv:tag:ciphertext`. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

/** Decrypts a blob produced by `encrypt`. Returns null on any error. */
export function decrypt(blob: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = blob.split(':');
    if (!ivB64 || !tagB64 || !dataB64) return null;

    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Returns true if a value looks like an encrypted blob. */
export function isEncrypted(value: string): boolean {
  return value.split(':').length === 3;
}
