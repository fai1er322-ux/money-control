/**
 * AES-GCM 256 envelope over WebCrypto (research.md R3).
 * A fresh random 12-byte IV is generated for every write.
 */
import { err, ok, type Result } from "../domain/result";

const ALGO = { name: "AES-GCM", length: 256 } as const;
const IV_BYTES = 12;

export interface Envelope {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
}

export function generateKey(extractable: boolean): Promise<CryptoKey> {
  return crypto.subtle.generateKey(ALGO, extractable, ["encrypt", "decrypt"]);
}

export async function exportKeyBase64(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

/** Imported keys are non-extractable: once in memory they cannot be read back out. */
export function importKeyBase64(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64(b64), ALGO, false, ["encrypt", "decrypt"]);
}

export async function encrypt(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  return { iv, ciphertext };
}

export async function decrypt(
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  ciphertext: Uint8Array<ArrayBuffer>,
): Promise<Result<Uint8Array<ArrayBuffer>, "DECRYPT_FAILED">> {
  try {
    return ok(
      new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)),
    );
  } catch {
    return err("DECRYPT_FAILED");
  }
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Throws on malformed input; callers treat that as corrupted data. */
export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
