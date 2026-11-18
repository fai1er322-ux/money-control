/**
 * In-memory mock of window.Telegram.WebApp for tests (tasks.md T010).
 * Callback signatures follow https://core.telegram.org/bots/webapps (Bot API 9.0):
 * the first callback argument is an error or null.
 */
import type { RawWebApp } from "../../src/telegram/webapp";

export interface TelegramMockOptions {
  version?: string;
  deviceStorage?: boolean;
  secureStorage?: boolean;
}

export interface TelegramMock {
  webApp: RawWebApp;
  device: Map<string, string>;
  secure: Map<string, string>;
  /** Keys that SecureStorage reports as restorable on this device, with their values. */
  restorable: Map<string, string>;
  /** Whether the user grants restoreItem. */
  allowRestore: boolean;
  /** Fail every DeviceStorage.setItem after this many successful calls (null = never). */
  failDeviceSetAfter: number | null;
  deviceSetCalls: number;
  /**
   * How a storage answers: normally, with an error on every call, or never (a client that
   * advertises Bot API 9.0 but does not implement the method — the callback is not called).
   */
  deviceBehavior: StoreBehavior;
  secureBehavior: StoreBehavior;
  downloads: { url: string; file_name: string }[];
  uninstall(): void;
}

export type StoreBehavior = "ok" | "error" | "hang";

type Cb<T> = ((err: string | null, value?: T, extra?: boolean) => void) | undefined;
const later = (fn: () => void) => setTimeout(fn, 0);

function withBehavior<S extends object>(store: S, behavior: () => StoreBehavior): S {
  const wrapped: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(store)) {
    wrapped[name] = (...args: unknown[]) => {
      const b = behavior();
      if (b === "ok") return (fn as (...a: unknown[]) => unknown)(...args);
      const cb = args.at(-1);
      if (b === "error" && typeof cb === "function") later(() => cb("UNSUPPORTED"));
      return wrapped;
    };
  }
  return wrapped as S;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function button() {
  return {
    text: "",
    isVisible: false,
    setText(t: string) {
      this.text = t;
      return this;
    },
    show() {
      this.isVisible = true;
      return this;
    },
    hide() {
      this.isVisible = false;
      return this;
    },
    onClick() {
      return this;
    },
    offClick() {
      return this;
    },
  };
}

export function installTelegramMock(opts: TelegramMockOptions = {}): TelegramMock {
  const version = opts.version ?? "9.1";
  const mock: TelegramMock = {
    webApp: undefined as unknown as RawWebApp,
    device: new Map(),
    secure: new Map(),
    restorable: new Map(),
    allowRestore: true,
    failDeviceSetAfter: null,
    deviceSetCalls: 0,
    deviceBehavior: "ok",
    secureBehavior: "ok",
    downloads: [],
    uninstall() {
      delete (window as { Telegram?: unknown }).Telegram;
    },
  };

  const DeviceStorage = {
    setItem(key: string, value: string, cb?: Cb<boolean>) {
      later(() => {
        if (mock.failDeviceSetAfter !== null && mock.deviceSetCalls >= mock.failDeviceSetAfter) {
          cb?.("STORAGE_ERROR");
          return;
        }
        mock.deviceSetCalls++;
        mock.device.set(key, value);
        cb?.(null, true);
      });
      return DeviceStorage;
    },
    getItem(key: string, cb: Cb<string | null>) {
      later(() => cb?.(null, mock.device.get(key) ?? null));
      return DeviceStorage;
    },
    removeItem(key: string, cb?: Cb<boolean>) {
      later(() => {
        mock.device.delete(key);
        cb?.(null, true);
      });
      return DeviceStorage;
    },
    clear(cb?: Cb<boolean>) {
      later(() => {
        mock.device.clear();
        cb?.(null, true);
      });
      return DeviceStorage;
    },
  };

  const SecureStorage = {
    setItem(key: string, value: string, cb?: Cb<boolean>) {
      later(() => {
        mock.secure.set(key, value);
        cb?.(null, true);
      });
      return SecureStorage;
    },
    getItem(key: string, cb: Cb<string | null>) {
      later(() => {
        const value = mock.secure.get(key);
        if (value !== undefined) cb?.(null, value);
        else cb?.(null, null, mock.restorable.has(key));
      });
      return SecureStorage;
    },
    restoreItem(key: string, cb?: Cb<string>) {
      later(() => {
        const value = mock.restorable.get(key);
        if (value === undefined || !mock.allowRestore) {
          cb?.("RESTORE_FAILED");
          return;
        }
        mock.secure.set(key, value);
        mock.restorable.delete(key);
        cb?.(null, value);
      });
      return SecureStorage;
    },
    removeItem(key: string, cb?: Cb<boolean>) {
      later(() => {
        mock.secure.delete(key);
        cb?.(null, true);
      });
      return SecureStorage;
    },
    clear(cb?: Cb<boolean>) {
      later(() => {
        mock.secure.clear();
        cb?.(null, true);
      });
      return SecureStorage;
    },
  };

  const webApp: RawWebApp = {
    version,
    platform: "unknown",
    colorScheme: "light",
    themeParams: { bg_color: "#ffffff", text_color: "#000000" },
    isVersionAtLeast: (v: string) => compareVersions(version, v) >= 0,
    ready: () => undefined,
    expand: () => undefined,
    onEvent: () => undefined,
    offEvent: () => undefined,
    downloadFile: (params: { url: string; file_name: string }) => {
      mock.downloads.push(params);
    },
    MainButton: button(),
    BackButton: button(),
    ...(opts.deviceStorage === false
      ? {}
      : { DeviceStorage: withBehavior(DeviceStorage, () => mock.deviceBehavior) }),
    ...(opts.secureStorage === false
      ? {}
      : { SecureStorage: withBehavior(SecureStorage, () => mock.secureBehavior) }),
  };
  mock.webApp = webApp;
  (window as { Telegram?: unknown }).Telegram = { WebApp: webApp };
  return mock;
}
