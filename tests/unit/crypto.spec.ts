import { describe, expect, it } from "vitest";
import {
  decrypt,
  encrypt,
  exportKeyBase64,
  fromBase64,
  generateKey,
  importKeyBase64,
  toBase64,
} from "../../src/storage/crypto";

const text = (s: string) => new TextEncoder().encode(s);
const str = (b: Uint8Array) => new TextDecoder().decode(b);

describe("AES-GCM envelope", () => {
  it("round-trips plaintext", async () => {
    const key = await generateKey(false);
    const env = await encrypt(key, text("бюджет"));
    const res = await decrypt(key, env.iv, env.ciphertext);
    expect(res.ok && str(res.value)).toBe("бюджет");
  });

  it("uses a 256-bit AES-GCM key", async () => {
    const key = await generateKey(false);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect(key.extractable).toBe(false);
  });

  it("uses a new 12-byte IV for every write", async () => {
    const key = await generateKey(false);
    const a = await encrypt(key, text("x"));
    const b = await encrypt(key, text("x"));
    expect(a.iv).toHaveLength(12);
    expect(toBase64(a.iv)).not.toBe(toBase64(b.iv));
    expect(toBase64(a.ciphertext)).not.toBe(toBase64(b.ciphertext));
  });

  it("returns DECRYPT_FAILED for tampered ciphertext", async () => {
    const key = await generateKey(false);
    const env = await encrypt(key, text("данные"));
    const tampered = env.ciphertext.slice();
    tampered[0] = tampered[0]! ^ 0xff;
    expect(await decrypt(key, env.iv, tampered)).toEqual({ ok: false, error: "DECRYPT_FAILED" });
  });

  it("returns DECRYPT_FAILED for a different key", async () => {
    const env = await encrypt(await generateKey(false), text("данные"));
    const res = await decrypt(await generateKey(false), env.iv, env.ciphertext);
    expect(res).toEqual({ ok: false, error: "DECRYPT_FAILED" });
  });

  it("exports and imports an extractable key as base64", async () => {
    const key = await generateKey(true);
    const b64 = await exportKeyBase64(key);
    const restored = await importKeyBase64(b64);
    const env = await encrypt(key, text("ключ"));
    const res = await decrypt(restored, env.iv, env.ciphertext);
    expect(res.ok && str(res.value)).toBe("ключ");
  });

  it("base64 helpers round-trip binary data", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
