/**
 * Browser-side stand-in for telegram-web-app.js in E2E runs (no request reaches telegram.org).
 * DeviceStorage and SecureStorage are backed by localStorage so data survives a reload.
 * The platform is "unknown", so the app draws its own buttons instead of Telegram's MainButton.
 * Must stay self-contained: it is serialized with Function.prototype.toString.
 */
export function installBrowserTelegramMock(): void {
  type Cb = ((err: string | null, value?: unknown, extra?: boolean) => void) | undefined;
  const later = (fn: () => void) => setTimeout(fn, 0);
  const kv = (prefix: string) => ({
    setItem(key: string, value: string, cb?: Cb) {
      later(() => {
        localStorage.setItem(prefix + key, value);
        cb?.(null, true);
      });
    },
    getItem(key: string, cb: Cb) {
      later(() => cb?.(null, localStorage.getItem(prefix + key), false));
    },
    removeItem(key: string, cb?: Cb) {
      later(() => {
        localStorage.removeItem(prefix + key);
        cb?.(null, true);
      });
    },
    clear(cb?: Cb) {
      later(() => {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith(prefix)) localStorage.removeItem(k);
        }
        cb?.(null, true);
      });
    },
    restoreItem(_key: string, cb?: Cb) {
      later(() => cb?.("RESTORE_FAILED"));
    },
  });
  const noop = () => undefined;
  const button = () => ({ setText: noop, show: noop, hide: noop, onClick: noop, offClick: noop });
  const version = "9.1";
  (window as unknown as { Telegram: unknown }).Telegram = {
    WebApp: {
      version,
      platform: "unknown",
      colorScheme: "light",
      themeParams: {},
      isVersionAtLeast: (v: string) => {
        const a = version.split(".").map(Number);
        const b = v.split(".").map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          const d = (a[i] ?? 0) - (b[i] ?? 0);
          if (d !== 0) return d > 0;
        }
        return true;
      },
      ready: noop,
      expand: noop,
      onEvent: noop,
      offEvent: noop,
      MainButton: button(),
      BackButton: button(),
      DeviceStorage: kv("tg.device."),
      SecureStorage: kv("tg.secure."),
    },
  };
}
