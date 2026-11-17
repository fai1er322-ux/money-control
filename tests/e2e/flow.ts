/** Shared E2E steps: open the app with the Telegram mock and fill the questionnaire. */
import { expect, type Page } from "@playwright/test";
import { installBrowserTelegramMock } from "./telegram-mock";

export interface Answers {
  incomeType: RegExp;
  income: string;
  min?: string;
  max?: string;
  mandatory: string;
  debtPayments: string;
  debtTotal: string;
  dependents: string;
  savings: string;
  goal: string;
  control: RegExp;
}

/** Profile E1 from contracts/scoring-rules-v1.md: stable 120 000 salary, 45 000 obligations. */
export const E1: Answers = {
  incomeType: /^Фиксированная зарплата/,
  income: "120 000",
  mandatory: "45000",
  debtPayments: "0",
  debtTotal: "0",
  dependents: "0",
  savings: "0",
  goal: "Накопить подушку безопасности",
  control: /^Просто/,
};

export async function openApp(page: Page) {
  await page.route("**/telegram-web-app.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `(${installBrowserTelegramMock.toString()})();`,
    }),
  );
  await page.goto("/");
  await expect(page.getByText(/Telegram на этом устройстве/)).toBeVisible();
  await page.getByRole("button", { name: "Понятно, начать" }).click();
}

export async function next(page: Page) {
  await page.getByRole("button", { name: "Далее" }).click();
}

export async function step1(page: Page, a: Answers) {
  await page.getByRole("radio", { name: a.incomeType }).check();
  const variable = a.min !== undefined;
  await page
    .getByLabel(variable ? "Средний доход в месяц" : "Чистый доход в месяц", { exact: true })
    .fill(a.income);
  if (variable) {
    await page.getByLabel("Доход в самый слабый месяц", { exact: true }).fill(a.min!);
    await page.getByLabel("Доход в самый сильный месяц", { exact: true }).fill(a.max!);
  }
}

export async function complete(page: Page, a: Answers) {
  await step1(page, a);
  await next(page);
  await page.getByLabel("Обязательные траты в месяц", { exact: true }).fill(a.mandatory);
  await page.getByLabel("Платежи по долгам в месяц", { exact: true }).fill(a.debtPayments);
  await page.getByLabel("Сколько всего осталось выплатить", { exact: true }).fill(a.debtTotal);
  await next(page);
  await page
    .getByLabel("Сколько человек зависят от вашего дохода", { exact: true })
    .fill(a.dependents);
  await page.getByLabel("Сколько у вас отложено", { exact: true }).fill(a.savings);
  await next(page);
  await page.getByRole("radio", { name: a.goal }).check();
  await page.getByRole("radio", { name: a.control }).check();
  await page.getByRole("button", { name: "Получить рекомендацию" }).click();
}
