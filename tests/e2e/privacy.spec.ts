import { expect, test } from "@playwright/test";
import { complete, E1, openApp } from "./flow";

// Constitution II / FR-020: the only traffic is the app's own static files.
test("a full session sends no requests except same-origin static GETs", async ({
  page,
  baseURL,
}) => {
  const requests: { url: string; method: string; body: string | null }[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );

  await openApp(page);
  await complete(page, E1);
  await page.getByRole("button", { name: "Принять метод" }).click();
  await page.getByRole("button", { name: "Данные" }).click();
  await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Скачать файл" }).click(),
  ]);

  const origin = new URL(baseURL!).origin;
  const unexpected = requests.filter(
    (r) =>
      !(
        r.url.startsWith(origin) ||
        r.url.startsWith("blob:") ||
        r.url.endsWith("/telegram-web-app.js")
      ) ||
      r.method !== "GET" ||
      r.body !== null,
  );
  expect(unexpected).toEqual([]);
  expect(requests.some((r) => r.url.includes("120000") || r.url.includes("4500000"))).toBe(false);
});
