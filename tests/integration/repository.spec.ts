import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAppState, type AppState } from "../../src/storage/app-state";
import { createRepository } from "../../src/storage/repository";
import { getWebApp } from "../../src/telegram/webapp";
import { installTelegramMock, type TelegramMock } from "../mocks/telegram";

const KEY = "mc.key.v1";
const META = "mc.state.meta";

function sampleState(note: string): AppState {
  return {
    ...emptyAppState(),
    profiles: [{ id: `profile-${note}`, createdAt: "2026-11-17T10:00:00.000Z" }],
    localStorageNoticeAcknowledgedAt: "2026-11-17T10:00:00.000Z",
  };
}

let tg: TelegramMock | null = null;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  // FR-020: any network call during storage operations fails the test.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network call is forbidden");
    }),
  );
  vi.stubGlobal(
    "XMLHttpRequest",
    vi.fn(() => {
      throw new Error("network call is forbidden");
    }),
  );
});

afterEach(() => {
  tg?.uninstall();
  tg = null;
  vi.unstubAllGlobals();
});

describe("mode selection", () => {
  it("uses telegram mode when Bot API ≥ 9.0 and both storages exist", async () => {
    tg = installTelegramMock({ version: "9.0" });
    const repo = await createRepository(getWebApp());
    expect(repo.mode).toBe("telegram");
  });

  it.each([
    { version: "8.0" },
    { version: "9.1", deviceStorage: false },
    { version: "9.1", secureStorage: false },
  ])("falls back to indexeddb for %o", async (opts) => {
    tg = installTelegramMock(opts);
    const repo = await createRepository(getWebApp());
    expect(repo.mode).toBe("indexeddb");
  });

  it("falls back to indexeddb outside Telegram", async () => {
    const repo = await createRepository(null);
    expect(repo.mode).toBe("indexeddb");
  });

  it("does not silently switch from telegram mode to an empty indexeddb store", async () => {
    tg = installTelegramMock();
    const first = await createRepository(getWebApp());
    await first.save(sampleState("a"));
    tg.uninstall();
    tg = installTelegramMock({ version: "8.0" });
    const second = await createRepository(getWebApp());
    expect(await second.load()).toEqual({ ok: false, error: "MODE_UNAVAILABLE" });
  });
});

describe.each(["telegram", "indexeddb"] as const)("%s mode", (mode) => {
  async function repo() {
    if (mode === "telegram") tg = installTelegramMock();
    const r = await createRepository(mode === "telegram" ? getWebApp() : null);
    expect(r.mode).toBe(mode);
    return r;
  }

  it("returns null when nothing has been saved", async () => {
    expect(await (await repo()).load()).toEqual({ ok: true, value: null });
  });

  it("round-trips the app state", async () => {
    const r = await repo();
    const state = sampleState("a");
    expect(await r.save(state)).toEqual({ ok: true, value: undefined });
    expect(await r.load()).toEqual({ ok: true, value: state });
  });

  it("overwrites on repeated saves", async () => {
    const r = await repo();
    await r.save(sampleState("a"));
    await r.save(sampleState("b"));
    const loaded = await r.load();
    expect(loaded.ok && loaded.value?.profiles[0]?.id).toBe("profile-b");
  });

  it("wipe() removes data and key", async () => {
    const r = await repo();
    await r.save(sampleState("a"));
    await r.wipe();
    expect(await r.load()).toEqual({ ok: true, value: null });
    if (tg) {
      expect(tg.device.size).toBe(0);
      expect(tg.secure.size).toBe(0);
    }
  });

  it("never touches the network", async () => {
    const r = await repo();
    await r.save(sampleState("a"));
    await r.load();
    await r.wipe();
    expect(fetch).not.toHaveBeenCalled();
    expect(XMLHttpRequest).not.toHaveBeenCalled();
  });
});

describe("telegram mode details", () => {
  it("stores only ciphertext in DeviceStorage and the key in SecureStorage", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("secret-marker"));
    expect(tg.secure.has(KEY)).toBe(true);
    for (const value of tg.device.values()) expect(value).not.toContain("secret-marker");
    expect(JSON.parse(tg.device.get(META)!)).toMatchObject({ format: 1, slot: "a" });
  });

  it("alternates slots and removes the previous slot", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("a"));
    await r.save(sampleState("b"));
    expect(JSON.parse(tg.device.get(META)!).slot).toBe("b");
    expect([...tg.device.keys()].some((k) => k.startsWith("mc.state.a."))).toBe(false);
  });

  it("splits large states into chunks of at most 32 KB", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    const big = sampleState("big");
    big.profiles = Array.from({ length: 2000 }, (_, i) => ({ id: `p-${i}`, note: "x".repeat(40) }));
    await r.save(big);
    const meta = JSON.parse(tg.device.get(META)!);
    expect(meta.chunks).toBeGreaterThan(1);
    for (const [k, v] of tg.device) if (k !== META) expect(v.length).toBeLessThanOrEqual(32 * 1024);
    expect(await r.load()).toEqual({ ok: true, value: big });
  });

  it("an interrupted write leaves meta on the old, intact slot", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("a"));
    tg.failDeviceSetAfter = tg.deviceSetCalls; // next DeviceStorage write fails
    const res = await r.save(sampleState("b"));
    expect(res).toEqual({ ok: false, error: "STORAGE_UNAVAILABLE" });
    tg.failDeviceSetAfter = null;
    const fresh = await createRepository(getWebApp());
    const loaded = await fresh.load();
    expect(loaded.ok && loaded.value?.profiles[0]?.id).toBe("profile-a");
  });

  it("restores a missing key through restoreItem", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("a"));
    tg.restorable.set(KEY, tg.secure.get(KEY)!);
    tg.secure.delete(KEY);
    const loaded = await (await createRepository(getWebApp())).load();
    expect(loaded.ok && loaded.value?.profiles[0]?.id).toBe("profile-a");
    expect(tg.secure.has(KEY)).toBe(true);
  });

  it("reports KEY_RESTORE_DECLINED when the user declines restore", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("a"));
    tg.restorable.set(KEY, tg.secure.get(KEY)!);
    tg.secure.delete(KEY);
    tg.allowRestore = false;
    expect(await (await createRepository(getWebApp())).load()).toEqual({
      ok: false,
      error: "KEY_RESTORE_DECLINED",
    });
  });

  it("reports KEY_MISSING and refuses to overwrite data with a new key", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("a"));
    tg.secure.delete(KEY);
    const r2 = await createRepository(getWebApp());
    expect(await r2.load()).toEqual({ ok: false, error: "KEY_MISSING" });
    expect(await r2.save(sampleState("b"))).toEqual({ ok: false, error: "KEY_MISSING" });
  });

  it("reports DECRYPT_FAILED when ciphertext is corrupted", async () => {
    tg = installTelegramMock();
    const r = await createRepository(getWebApp());
    await r.save(sampleState("a"));
    const chunkKey = [...tg.device.keys()].find((k) => k !== META)!;
    const v = tg.device.get(chunkKey)!;
    tg.device.set(chunkKey, (v[0] === "A" ? "B" : "A") + v.slice(1));
    expect(await r.load()).toEqual({ ok: false, error: "DECRYPT_FAILED" });
  });
});

describe("schema validation", () => {
  it("rejects a decrypted payload that is not a valid AppState", async () => {
    const r = await createRepository(null);
    // Bypass save()'s typing to store something with an unknown schema version.
    await r.save({ ...emptyAppState(), schemaVersion: 99 } as unknown as AppState);
    expect(await r.load()).toEqual({ ok: false, error: "SCHEMA_INVALID" });
  });
});
