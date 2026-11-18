import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { complete, E1, openApp } from "./flow";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-10T12:00:00"));
  await openApp(page);
  await complete(page, E1);
  await page.getByRole("button", { name: "Принять метод" }).click();
  await expect(page.getByRole("heading", { name: "План на декабрь 2026" })).toBeVisible();
  await page.getByRole("button", { name: "Данные" }).click();
});

test("export → delete everything → import restores the plan", async ({ page }) => {
  await expect(page.getByText(/Telegram на этом устройстве/)).toBeVisible();
  await expect(page.getByText(/Файл не зашифрован/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Скачать файл" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("money-control-2026-12-10.json");
  const path = await download.path();
  const file = JSON.parse(await readFile(path, "utf8"));
  expect(file).toMatchObject({ app: "money-control", exportFormat: 1 });
  expect(file.state.plans).toHaveLength(1);

  await page.getByRole("button", { name: "Удалить все данные" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("button", { name: "Понятно, начать" })).toBeVisible();

  await page.getByRole("button", { name: "У меня есть копия данных" }).click();
  await page.getByLabel("Файл экспорта").setInputFiles(path);
  await expect(page.getByLabel("Или вставьте текст экспорта")).not.toHaveValue("");
  await page.getByRole("button", { name: "Загрузить данные" }).click();
  await expect(page.getByRole("heading", { name: "План на декабрь 2026" })).toBeVisible();
  await expect(page.locator('[data-part="needs"]')).toHaveText(/60\s000\s₽/);
});

test("a foreign or broken file is rejected and current data stays", async ({ page }) => {
  const text = page.getByLabel("Или вставьте текст экспорта");
  await text.fill(JSON.stringify({ hello: "world" }));
  await page.getByRole("button", { name: "Загрузить данные" }).click();
  await expect(page.getByText("Это файл другого приложения.")).toBeVisible();

  await text.fill('{"app":"money-control","exportFormat":1,"state":{}}');
  await page.getByRole("button", { name: "Загрузить данные" }).click();
  await expect(page.getByText(/Файл повреждён или изменён вручную/)).toBeVisible();

  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.locator('[data-part="needs"]')).toHaveText(/60\s000\s₽/);
});

test("importing over existing data asks for confirmation", async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Скачать файл" }).click(),
  ]);
  await page.getByLabel("Файл экспорта").setInputFiles(await download.path());
  await page.getByRole("button", { name: "Загрузить данные" }).click();
  await expect(page.getByText(/будут заменены данными из копии/)).toBeVisible();
  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(page.getByText(/будут заменены данными из копии/)).toHaveCount(0);
});
