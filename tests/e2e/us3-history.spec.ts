import { expect, test, type Page } from "@playwright/test";
import { complete, E1, next, openApp } from "./flow";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-10T12:00:00"));
  await openApp(page);
});

/** E3 from contracts/scoring-rules-v1.md: 80 % obligations, 30 % debt load → envelopes. */
const E3 = {
  ...E1,
  income: "100000",
  mandatory: "50000",
  debtPayments: "30000",
  debtTotal: "600000",
  dependents: "1",
  goal: "Закрыть долги",
  control: /^Подробно/,
};

/** Opens the questionnaire prefilled with the current answers and goes to step 2. */
async function editObligations(page: Page, debtPayments: string, debtTotal: string) {
  await page.getByRole("button", { name: "Изменить ответы" }).click();
  await expect(page.getByLabel("Чистый доход в месяц", { exact: true })).toHaveValue("100000");
  await next(page);
  await page.getByLabel("Платежи по долгам в месяц", { exact: true }).fill(debtPayments);
  await page.getByLabel("Сколько всего осталось выплатить", { exact: true }).fill(debtTotal);
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Получить рекомендацию" }).click();
}

test("US3.1: paying off the loan changes the method and explains the changed factors", async ({
  page,
}) => {
  await complete(page, E3);
  await expect(page.getByRole("heading", { name: "Рекомендуем: Конверты" })).toBeVisible();
  await page.getByRole("button", { name: "Принять метод" }).click();
  await expect(page.getByRole("heading", { name: "План на декабрь 2026" })).toBeVisible();

  await editObligations(page, "0", "0");

  await expect(page.getByRole("heading", { name: "Рекомендуем: 50/30/20" })).toBeVisible();
  const change = page.getByRole("region", { name: "Что изменилось" });
  await expect(change).toContainText("Рекомендация изменилась: было «Конверты», стало «50/30/20»");
  await expect(change).toContainText(/Долговая нагрузка: 30\s% → 0\s%/);
  await expect(change).toContainText(/Доля обязательных трат и долгов: 80\s% → 50\s%/);
});

test("US3.2: the same method stays suitable and the plan sums are updated", async ({ page }) => {
  await complete(page, E1);
  await page.getByRole("button", { name: "Принять метод" }).click();
  await expect(page.locator('[data-part="needs"]')).toHaveText(/60\s000\s₽/);

  await page.getByRole("button", { name: "Изменить ответы" }).click();
  await page.getByLabel("Чистый доход в месяц", { exact: true }).fill("130000");
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Получить рекомендацию" }).click();

  const change = page.getByRole("region", { name: "Что изменилось" });
  await expect(change).toContainText("Метод остаётся подходящим.");
  await expect(change).toContainText("Суммы плана пересчитаны по новым ответам.");
  await page.getByRole("button", { name: "К плану" }).click();
  await expect(page.locator('[data-part="needs"]')).toHaveText(/65\s000\s₽/);
});

test("US3.3: history lists every recommendation with date, rules version and decision", async ({
  page,
}) => {
  await complete(page, E3);
  await page.getByRole("button", { name: "Принять метод" }).click();
  await editObligations(page, "0", "0");
  await page.getByRole("button", { name: "Выбрать другой метод" }).click();
  await page.getByRole("button", { name: "Выбрать «Сначала заплати себе»" }).click();
  await page.getByRole("button", { name: "История" }).click();

  await expect(page.getByRole("heading", { name: "История рекомендаций" })).toBeVisible();
  const items = page.locator(".history-list > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("50/30/20");
  await expect(items.nth(0)).toContainText("Текущая");
  await expect(items.nth(0)).toContainText("Отклонена, выбран метод «Сначала заплати себе»");
  await expect(items.nth(1)).toContainText("Конверты");
  await expect(items.nth(1)).toContainText("Принята");
  for (const i of [0, 1]) {
    await expect(items.nth(i)).toContainText("правила 1.0.0");
    await expect(items.nth(i)).toContainText("10 дек. 2026");
  }
});
