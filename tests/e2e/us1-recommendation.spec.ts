import { expect, test } from "@playwright/test";
import { complete, E1, next, openApp, step1 } from "./flow";

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test("US1.1: stable salary gets 50/30/20, explained by stability and a 37,5 % share", async ({
  page,
}) => {
  await complete(page, E1);
  await expect(page.getByRole("heading", { name: "Рекомендуем: 50/30/20" })).toBeVisible();
  await expect(page.getByText(/Доход стабилен/)).toBeVisible();
  await expect(page.getByText(/37,5\s%/)).toBeVisible();
});

test("US1.2: freelancer gets base income + buffer because of unstable income", async ({ page }) => {
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
  await expect(
    page.getByRole("heading", { name: "Рекомендуем: Базовый доход + буфер" }),
  ).toBeVisible();
  await expect(page.getByText(/Доход нестабилен/)).toBeVisible();
});

test("US1.3: 80 % obligations get envelopes with debt load as the main reason", async ({
  page,
}) => {
  await complete(page, {
    ...E1,
    income: "100000",
    mandatory: "50000",
    debtPayments: "30000",
    debtTotal: "600000",
    dependents: "1",
    goal: "Закрыть долги",
    control: /^Подробно/,
  });
  await expect(page.getByRole("heading", { name: "Рекомендуем: Конверты" })).toBeVisible();
  const factors = page.locator(".factor-list li");
  await expect(factors).toHaveCount(4);
  await expect(factors.first()).toContainText("Высокая долговая нагрузка");
});

test("US1.4: details show factor contributions, the alternative and the disclaimer", async ({
  page,
}) => {
  await complete(page, E1);
  await expect(page.getByLabel("вклад в оценку: 30")).toBeVisible();
  await expect(page.getByRole("region", { name: "Альтернатива" })).toContainText(
    "Сначала заплати себе",
  );
  await expect(page.getByRole("note")).toContainText("информационный характер");
});

test("FR-004: an interrupted questionnaire resumes after a reload", async ({ page }) => {
  await step1(page, E1);
  await next(page);
  await page.getByLabel("Обязательные траты в месяц", { exact: true }).fill("45000");
  // The encrypted save is asynchronous: retry the reload until the draft is there.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Шаг 2 из 4")).toBeVisible();
    await expect(page.getByLabel("Обязательные траты в месяц", { exact: true })).toHaveValue(
      "45000",
    );
  }).toPass();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByLabel("Чистый доход в месяц", { exact: true })).toHaveValue("120000");
});

test("FR-003: a negative amount shows an error next to the field", async ({ page }) => {
  const income = page.getByLabel("Чистый доход в месяц", { exact: true });
  await income.fill("-5");
  await expect(income).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Сумма не может быть отрицательной")).toBeVisible();
});

test("FR-012: obligations above income switch to the deficit mode", async ({ page }) => {
  await complete(page, {
    ...E1,
    income: "50000",
    mandatory: "45000",
    debtPayments: "10000",
    debtTotal: "200000",
    goal: "Закрыть долги",
  });
  await expect(
    page.getByRole("heading", { name: "Сначала — свести доход и обязательные траты" }),
  ).toBeVisible();
  await expect(page.getByText(/больше дохода на 5\s000\s₽/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Рекомендуем/ })).toHaveCount(0);
});
