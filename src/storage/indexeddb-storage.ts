/**
 * Fallback backend: IndexedDB with a non-extractable WebCrypto key (research.md R2).
 * The whole envelope is written in one transaction, so writes are atomic without slots.
 */
import { err, ok } from "../domain/result";
import type { EncryptedBackend } from "./backend";
import { generateKey } from "./crypto";
import { idbDelete, idbGet, idbPut } from "./idb";

const KEY_NAME = "mc.key.v1";
const STATE_NAME = "mc.state";

function asBytes(v: unknown): Uint8Array<ArrayBuffer> | null {
  if (!ArrayBuffer.isView(v)) return null;
  return new Uint8Array(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
}

export function createIndexedDbBackend(): EncryptedBackend {
  return {
    mode: "indexeddb",

    async loadKey() {
      const key = await idbGet<CryptoKey>("keys", KEY_NAME);
      return ok(key ?? null);
    },

    async createKey() {
      const key = await generateKey(false);
      await idbPut("keys", KEY_NAME, key);
      return key;
    },

    async readEnvelope() {
      const stored = await idbGet<{ iv?: unknown; ciphertext?: unknown }>("state", STATE_NAME);
      if (stored === undefined) return ok(null);
      // Structured clone may return typed arrays from another realm, so avoid `instanceof`.
      const iv = asBytes(stored.iv);
      const ciphertext = asBytes(stored.ciphertext);
      return iv && ciphertext ? ok({ iv, ciphertext }) : err("DECRYPT_FAILED");
    },

    async writeEnvelope(envelope) {
      await idbPut("state", STATE_NAME, envelope);
    },

    async wipe() {
      await idbDelete("state", STATE_NAME);
      await idbDelete("keys", KEY_NAME);
    },
  };
}
