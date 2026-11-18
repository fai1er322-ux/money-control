/**
 * Thin typed wrapper over window.Telegram.WebApp (research.md R4).
 * Only the parts this app uses are typed. initData / user.id are intentionally not exposed
 * (research.md R10): the app never reads or stores the Telegram identity.
 */

type StorageCallback<T> = (error: string | null, value?: T, canRestore?: boolean) => void;

interface RawKvStorage {
  setItem(key: string, value: string, callback?: StorageCallback<boolean>): unknown;
  getItem(key: string, callback: StorageCallback<string | null>): unknown;
  removeItem(key: string, callback?: StorageCallback<boolean>): unknown;
  clear(callback?: StorageCallback<boolean>): unknown;
}

interface RawSecureStorage extends RawKvStorage {
  restoreItem(key: string, callback?: StorageCallback<string>): unknown;
}

interface RawBottomButton {
  setText(text: string): unknown;
  show(): unknown;
  hide(): unknown;
  onClick(cb: () => void): unknown;
  offClick(cb: () => void): unknown;
}

export interface RawWebApp {
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string | undefined>;
  isVersionAtLeast(version: string): boolean;
  ready(): void;
  expand(): void;
  onEvent(event: string, cb: () => void): void;
  offEvent(event: string, cb: () => void): void;
  downloadFile?(params: { url: string; file_name: string }, cb?: (accepted: boolean) => void): void;
  MainButton: RawBottomButton;
  BackButton: Omit<RawBottomButton, "setText">;
  DeviceStorage?: RawKvStorage;
  SecureStorage?: RawSecureStorage;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: RawWebApp };
  }
}

export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SecureKvStore extends KvStore {
  /** Value, or null plus whether Telegram can restore the key on this device. */
  getWithRestoreInfo(key: string): Promise<{ value: string | null; canRestore: boolean }>;
  /** Asks the user to restore the key; resolves null if declined or unavailable. */
  restore(key: string): Promise<string | null>;
}

export class TelegramStorageError extends Error {
  constructor(op: string, reason: string) {
    super(`Telegram storage ${op} failed: ${reason}`);
    this.name = "TelegramStorageError";
  }
}

/**
 * A client that does not implement a storage method never calls back (telegram-web-app.js just
 * posts the event), so every call has a deadline; a silent hang would lose saves without a trace.
 */
export const STORAGE_TIMEOUT_MS = 5000;
/** restoreItem waits for the user's answer in a system dialog. */
const RESTORE_TIMEOUT_MS = 60_000;

function withDeadline<T>(
  op: string,
  ms: number,
  run: (resolve: (v: T) => void, reject: (e: unknown) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TelegramStorageError(op, "TIMEOUT")), ms);
    run(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function call<T>(
  op: string,
  ms: number,
  run: (cb: StorageCallback<T>) => void,
): Promise<T | undefined> {
  return withDeadline(op, ms, (resolve, reject) => {
    run((error, value) => {
      if (error) reject(new TelegramStorageError(op, error));
      else resolve(value);
    });
  });
}

function wrapKv(raw: RawKvStorage, ms: number): KvStore {
  return {
    async get(key) {
      return (await call<string | null>("get", ms, (cb) => raw.getItem(key, cb))) ?? null;
    },
    async set(key, value) {
      await call<boolean>("set", ms, (cb) => raw.setItem(key, value, cb));
    },
    async remove(key) {
      await call<boolean>("remove", ms, (cb) => raw.removeItem(key, cb));
    },
  };
}

function wrapSecure(raw: RawSecureStorage, ms: number): SecureKvStore {
  return {
    ...wrapKv(raw, ms),
    getWithRestoreInfo(key) {
      return withDeadline("get", ms, (resolve, reject) => {
        raw.getItem(key, (error, value, canRestore) => {
          if (error) reject(new TelegramStorageError("get", error));
          else resolve({ value: value ?? null, canRestore: canRestore === true });
        });
      });
    },
    restore(key) {
      return withDeadline<string | null>("restore", RESTORE_TIMEOUT_MS, (resolve) => {
        raw.restoreItem(key, (error, value) => resolve(error ? null : (value ?? null)));
      }).catch(() => null);
    },
  };
}

export interface TelegramWebApp {
  readonly version: string;
  readonly platform: string;
  isVersionAtLeast(version: string): boolean;
  readonly deviceStorage: KvStore | null;
  readonly secureStorage: SecureKvStore | null;
  ready(): void;
  expand(): void;
  /** Copies Telegram theme colors into CSS variables and keeps them in sync. */
  bindTheme(root?: HTMLElement): () => void;
  downloadFile(url: string, fileName: string): Promise<boolean>;
  readonly mainButton: RawBottomButton;
  readonly backButton: Omit<RawBottomButton, "setText">;
}

function applyTheme(raw: RawWebApp, root: HTMLElement): void {
  for (const [name, value] of Object.entries(raw.themeParams)) {
    if (value) root.style.setProperty(`--tg-${name.replace(/_/g, "-")}`, value);
  }
  root.dataset.theme = raw.colorScheme;
}

export function wrapWebApp(
  raw: RawWebApp,
  { storageTimeoutMs = STORAGE_TIMEOUT_MS }: { storageTimeoutMs?: number } = {},
): TelegramWebApp {
  return {
    version: raw.version,
    platform: raw.platform,
    isVersionAtLeast: (v) => raw.isVersionAtLeast(v),
    deviceStorage: raw.DeviceStorage ? wrapKv(raw.DeviceStorage, storageTimeoutMs) : null,
    secureStorage: raw.SecureStorage ? wrapSecure(raw.SecureStorage, storageTimeoutMs) : null,
    ready: () => raw.ready(),
    expand: () => raw.expand(),
    bindTheme(root = document.documentElement) {
      const handler = () => applyTheme(raw, root);
      handler();
      raw.onEvent("themeChanged", handler);
      return () => raw.offEvent("themeChanged", handler);
    },
    downloadFile(url, fileName) {
      return new Promise((resolve) => {
        if (!raw.downloadFile) return resolve(false);
        raw.downloadFile({ url, file_name: fileName }, (accepted) => resolve(accepted));
      });
    },
    mainButton: raw.MainButton,
    backButton: raw.BackButton,
  };
}

/**
 * Returns the wrapped WebApp, or null when the Telegram script is not loaded.
 * In a plain browser telegram-web-app.js still defines WebApp (platform "unknown", old
 * version, no DeviceStorage), so callers rely on capability checks, not on presence.
 */
export function getWebApp(): TelegramWebApp | null {
  const raw = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  return raw ? wrapWebApp(raw) : null;
}
