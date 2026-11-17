/** Shared types for the on-device storage (contracts/storage.md). */
import type { Result } from "../domain/result";
import type { Envelope } from "./crypto";

export type StorageMode = "telegram" | "indexeddb";

export type LoadError =
  | "DECRYPT_FAILED"
  | "KEY_MISSING"
  | "KEY_RESTORE_DECLINED"
  | "SCHEMA_INVALID"
  | "MODE_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE";

export type SaveError =
  "QUOTA_EXCEEDED" | "STORAGE_UNAVAILABLE" | "KEY_MISSING" | "MODE_UNAVAILABLE";

/**
 * A place that holds one encrypted envelope and its key. Storage I/O failures throw;
 * the repository maps them to LoadError / SaveError.
 */
export interface EncryptedBackend {
  readonly mode: StorageMode;
  /** null — no key stored; error — key exists elsewhere but cannot be obtained. */
  loadKey(): Promise<Result<CryptoKey | null, "KEY_RESTORE_DECLINED">>;
  createKey(): Promise<CryptoKey>;
  /** null — nothing saved; error — stored bytes are not a readable envelope. */
  readEnvelope(): Promise<Result<Envelope | null, "DECRYPT_FAILED">>;
  writeEnvelope(envelope: Envelope): Promise<void>;
  wipe(): Promise<void>;
}
