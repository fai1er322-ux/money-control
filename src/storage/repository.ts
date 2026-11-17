/**
 * StateRepository — encrypted, on-device persistence of AppState (contracts/storage.md).
 * Never performs network requests (FR-020) and never logs state contents (constitution II).
 */
import { err, ok, type Result } from "../domain/result";
import type { TelegramWebApp } from "../telegram/webapp";
import { migrate, type AppState } from "./app-state";
import type { EncryptedBackend, LoadError, SaveError, StorageMode } from "./backend";
import { decrypt, encrypt } from "./crypto";
import { idbDelete, idbGet, idbPut } from "./idb";
import { createIndexedDbBackend } from "./indexeddb-storage";
import { createTelegramBackend } from "./telegram-storage";

export type { LoadError, SaveError, StorageMode } from "./backend";

export interface StateRepository {
  readonly mode: StorageMode;
  /** null — nothing saved yet. */
  load(): Promise<Result<AppState | null, LoadError>>;
  save(state: AppState): Promise<Result<void, SaveError>>;
  /** FR-021: removes data and key. */
  wipe(): Promise<void>;
}

/** Remembers on this device that data lives in Telegram storage, to avoid silent mode switches. */
const MODE_MARKER = "mode";

export function selectMode(webApp: TelegramWebApp | null): StorageMode {
  return webApp?.isVersionAtLeast("9.0") && webApp.deviceStorage && webApp.secureStorage
    ? "telegram"
    : "indexeddb";
}

export async function createRepository(webApp: TelegramWebApp | null): Promise<StateRepository> {
  const mode = selectMode(webApp);
  const backend: EncryptedBackend =
    mode === "telegram" && webApp?.deviceStorage && webApp.secureStorage
      ? createTelegramBackend(webApp.deviceStorage, webApp.secureStorage)
      : createIndexedDbBackend();

  // Data was previously stored in Telegram storage, which this client does not provide.
  const modeUnavailable = mode === "indexeddb" && (await safeMarker()) === "telegram";

  let key: CryptoKey | null = null;

  async function obtainKey(): Promise<Result<CryptoKey | null, LoadError>> {
    if (key) return ok(key);
    const loaded = await backend.loadKey();
    if (loaded.ok) key = loaded.value;
    return loaded;
  }

  return {
    mode,

    async load() {
      if (modeUnavailable) return err("MODE_UNAVAILABLE");
      try {
        const envelope = await backend.readEnvelope();
        if (!envelope.ok) return envelope;
        if (envelope.value === null) return ok(null);
        const k = await obtainKey();
        if (!k.ok) return k;
        if (k.value === null) return err("KEY_MISSING");
        const plain = await decrypt(k.value, envelope.value.iv, envelope.value.ciphertext);
        if (!plain.ok) return plain;
        let raw: unknown;
        try {
          raw = JSON.parse(new TextDecoder().decode(plain.value));
        } catch {
          return err("SCHEMA_INVALID");
        }
        return migrate(raw);
      } catch {
        return err("STORAGE_UNAVAILABLE");
      }
    },

    async save(state) {
      if (modeUnavailable) return err("MODE_UNAVAILABLE");
      try {
        const k = await obtainKey();
        let current = k.ok ? k.value : null;
        if (current === null) {
          // Never encrypt over existing data with a fresh key: that would destroy it.
          const existing = await backend.readEnvelope();
          if (!existing.ok || existing.value !== null) return err("KEY_MISSING");
          current = key = await backend.createKey();
        }
        const plaintext = new TextEncoder().encode(JSON.stringify(state));
        await backend.writeEnvelope(await encrypt(current, plaintext));
        if (mode === "telegram")
          await idbPut("meta", MODE_MARKER, "telegram").catch(() => undefined);
        return ok(undefined);
      } catch (e) {
        const quota = e instanceof DOMException && e.name === "QuotaExceededError";
        return err(quota ? "QUOTA_EXCEEDED" : "STORAGE_UNAVAILABLE");
      }
    },

    async wipe() {
      await backend.wipe();
      key = null;
      await idbDelete("meta", MODE_MARKER).catch(() => undefined);
    },
  };
}

async function safeMarker(): Promise<string | undefined> {
  try {
    return await idbGet<string>("meta", MODE_MARKER);
  } catch {
    return undefined;
  }
}
