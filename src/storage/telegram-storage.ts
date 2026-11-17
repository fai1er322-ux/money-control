/**
 * Telegram backend: ciphertext in DeviceStorage, key in SecureStorage (contracts/storage.md).
 * Writes go to the inactive slot first and only then switch `meta`, so an interrupted write
 * leaves the previous slot intact.
 */
import { err, ok } from "../domain/result";
import type { KvStore, SecureKvStore } from "../telegram/webapp";
import type { EncryptedBackend } from "./backend";
import {
  exportKeyBase64,
  fromBase64,
  generateKey,
  importKeyBase64,
  toBase64,
  type Envelope,
} from "./crypto";

export const KEY_NAME = "mc.key.v1";
export const META_NAME = "mc.state.meta";
export const CHUNK_CHARS = 32 * 1024;

type Slot = "a" | "b";

interface Meta {
  format: 1;
  slot: Slot;
  chunks: number;
  iv: string;
  bytes: number;
}

const chunkKey = (slot: Slot, i: number) => `mc.state.${slot}.${i}`;
const otherSlot = (s: Slot): Slot => (s === "a" ? "b" : "a");

function parseMeta(raw: string | null): Meta | null | "invalid" {
  if (raw === null) return null;
  try {
    const m = JSON.parse(raw) as Partial<Meta>;
    const valid =
      m.format === 1 &&
      (m.slot === "a" || m.slot === "b") &&
      Number.isInteger(m.chunks) &&
      typeof m.iv === "string" &&
      Number.isInteger(m.bytes);
    return valid ? (m as Meta) : "invalid";
  } catch {
    return "invalid";
  }
}

export function createTelegramBackend(device: KvStore, secure: SecureKvStore): EncryptedBackend {
  async function readMeta() {
    return parseMeta(await device.get(META_NAME));
  }

  async function removeSlot(slot: Slot, known?: number) {
    // Without a known count, probe until the first missing chunk (leftovers of failed writes).
    for (let i = 0; known === undefined || i < known; i++) {
      if (known === undefined && (await device.get(chunkKey(slot, i))) === null) break;
      await device.remove(chunkKey(slot, i));
    }
  }

  return {
    mode: "telegram",

    async loadKey() {
      const { value, canRestore } = await secure.getWithRestoreInfo(KEY_NAME);
      if (value !== null) return ok(await importKeyBase64(value));
      if (!canRestore) return ok(null);
      const restored = await secure.restore(KEY_NAME);
      return restored === null ? err("KEY_RESTORE_DECLINED") : ok(await importKeyBase64(restored));
    },

    async createKey() {
      // Extractable only long enough to persist it; the in-memory copy is re-imported non-extractable.
      const b64 = await exportKeyBase64(await generateKey(true));
      await secure.set(KEY_NAME, b64);
      return importKeyBase64(b64);
    },

    async readEnvelope() {
      const meta = await readMeta();
      if (meta === null) return ok(null);
      if (meta === "invalid") return err("DECRYPT_FAILED");
      const parts: string[] = [];
      for (let i = 0; i < meta.chunks; i++) {
        const part = await device.get(chunkKey(meta.slot, i));
        if (part === null) return err("DECRYPT_FAILED");
        parts.push(part);
      }
      try {
        const ciphertext = fromBase64(parts.join(""));
        if (ciphertext.length !== meta.bytes) return err("DECRYPT_FAILED");
        return ok({ iv: fromBase64(meta.iv), ciphertext });
      } catch {
        return err("DECRYPT_FAILED");
      }
    },

    async writeEnvelope(envelope: Envelope) {
      const current = await readMeta();
      const prev = current === null || current === "invalid" ? null : current;
      const slot: Slot = prev ? otherSlot(prev.slot) : "a";
      const b64 = toBase64(envelope.ciphertext);
      const chunks = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
      for (let i = 0; i < chunks; i++) {
        await device.set(chunkKey(slot, i), b64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS));
      }
      const meta: Meta = {
        format: 1,
        slot,
        chunks,
        iv: toBase64(envelope.iv),
        bytes: envelope.ciphertext.length,
      };
      await device.set(META_NAME, JSON.stringify(meta));
      if (prev) await removeSlot(prev.slot, prev.chunks);
    },

    async wipe() {
      const meta = await readMeta();
      await device.remove(META_NAME);
      if (meta && meta !== "invalid") await removeSlot(meta.slot, meta.chunks);
      await removeSlot("a");
      await removeSlot("b");
      await secure.remove(KEY_NAME);
    },
  };
}
