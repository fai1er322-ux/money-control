import { expect, test, type Page } from "@playwright/test";
import { complete, E1, openApp } from "./flow";

// Fixed clock: the plan covers the current month, and E5 is defined for December 2026.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-10T12:00:00"));
  await openApp(page);
});

/** Amount shown for a plan part, e.g. "60 000 ₽" with non-breaking spaces normalized. */
async function part(page: Page, key: string): Promise<string> {
  const text = await page.locator(`[data-part="${key}"]`).innerText();
  return text.replace(/\s/g, " ");
}

test("US2.1: accepting 50/30/20 for 120 000 gives 60 000 / 36 000 / 24 000", async ({ page }) => {
  await complete(page, E1);
  await page.getByRole("button", { name: "Принять метод" }).click();
  await expect(page.getByRole("heading", { name: "План на декабрь 2026" })).toBeVisible();
  expect(await part(page, "needs")).toBe("60 000 ₽");
  expect(await part(page, "wants")).toBe("36 000 ₽");
  expect(await part(page, "savings")).toBe("24 000 ₽");
  await expect(page.getByText(/Итого: 120\s000\s₽/)).toBeVisible();
});

test("US2.2 + US2.3: choosing weekly limits splits 40 000 into the weeks of the month", async ({
  page,
}) => {
  await complete(page, { ...E1, income: "100000", mandatory: "50000" });
  await expect(page.getByRole("heading", { name: "Рекомендуем: 50/30/20" })).toBeVisible();
  await page.getByRole("button", { name: "Выбрать другой метод" }).click();
  await page.getByRole("button", { name: "Выбрать «Недельные лимиты»" }).click();

  await expect(page.getByText("Метод: Недельные лимиты")).toBeVisible();
  expect(await part(page, "obligations")).toBe("50 000 ₽");
  expect(await part(page, "savings")).toBe("10 000 ₽");
  expect(await part(page, "flexible")).toBe("40 000 ₽");

  const weeks = page.locator(".weeks-table tr");
  await expect(weeks).toHaveCount(5);
  await expect(weeks.nth(0)).toContainText(/01\.12–06\.12.*7\s741,93\s₽/);
  await expect(weeks.nth(4)).toContainText(/28\.12–31\.12.*5\s161,32\s₽/);

  // US2.3: the rejected recommendation is recorded and shown.
  await expect(
    page.getByText("Вы выбрали этот метод вместо рекомендованного «50/30/20»."),
  ).toBeVisible();
});

test("US2.4: a manual edit rebalances the other parts and warns about low savings", async ({
  page,
}) => {
  await complete(page, E1);
  await page.getByRole("button", { name: "Принять метод" }).click();

  await page.getByRole("button", { name: "Изменить: Желания" }).click();
  await page.getByLabel("Новая сумма: Желания", { exact: true }).fill("50000");
  await page.getByRole("button", { name: "Сохранить" }).click();
  expect(await part(page, "needs")).toBe("50 000 ₽");
  expect(await part(page, "savings")).toBe("20 000 ₽");
  await expect(page.getByText(/Итого: 120\s000\s₽/)).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByRole("button", { name: "Изменить: Желания" }).click();
  await page.getByLabel("Новая сумма: Желания", { exact: true }).fill("100000");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("status")).toContainText("Накопления меньше минимума метода");
  await expect(page.getByText(/Итого: 120\s000\s₽/)).toBeVisible();

  await page.getByRole("button", { name: "Изменить: Желания" }).click();
  await page.getByLabel("Новая сумма: Желания", { exact: true }).fill("130000");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(/больше, чем остаётся от дохода/)).toBeVisible();
});

test("the active plan opens after a reload", async ({ page }) => {
  await complete(page, E1);
  await page.getByRole("button", { name: "Принять метод" }).click();
  await expect(page.getByRole("heading", { name: "План на декабрь 2026" })).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name: "План на декабрь 2026" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
});

test("FR-017: base income + buffer explains where income above the base goes", async ({ page }) => {
  await complete(page, {
    ...E1,
    incomeType: /^Фриланс/,
    income: "90000",
    min: "40000",
    max: "150000",
    mandatory: "30000",
    savings: "50000",
    goal: "Взять траты под контроль",
  });
  await page.getByRole("button", { name: "Принять метод" }).click();
  await expect(page.getByText(/40\s000\s₽ — ваш самый слабый месяц/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Если заработаете больше" })).toContainText(
    /пока он не наберёт 90\s000\s₽/,
  );
});
