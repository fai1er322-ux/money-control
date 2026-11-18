import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { complete, E1, openApp } from "./flow";

async function expectNoViolations(page: Page, screen: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const summary = result.violations.map(
    (v) => `${screen}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`every screen passes axe in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.clock.setFixedTime(new Date("2026-12-10T12:00:00"));
    await page.route("**/telegram-web-app.js", (route) =>
      route.fulfill({ contentType: "text/javascript", body: "" }),
    );
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Понятно, начать" })).toBeVisible();
    await expectNoViolations(page, "welcome");

    await page.getByRole("button", { name: "Понятно, начать" }).click();
    await page.getByRole("button", { name: "Далее" }).click();
    await expect(page.getByText("Ответьте на этот вопрос").first()).toBeVisible();
    await expectNoViolations(page, "questionnaire with errors");

    await complete(page, E1);
    await expectNoViolations(page, "recommendation");

    await page.getByRole("button", { name: "Принять метод" }).click();
    await expectNoViolations(page, "plan");

    await page.getByRole("button", { name: "Изменить: Желания" }).click();
    await expectNoViolations(page, "plan editing");
    await page.getByRole("button", { name: "Отмена" }).click();

    await page.getByRole("button", { name: "Сменить метод" }).click();
    await expectNoViolations(page, "catalog");
    await page.getByRole("button", { name: "Выбрать «Недельные лимиты»" }).click();
    await expectNoViolations(page, "plan with weekly limits");

    await page.getByRole("button", { name: "История" }).click();
    await expectNoViolations(page, "history");
    await page.getByRole("button", { name: "Назад" }).click();

    await page.getByRole("button", { name: "Данные" }).click();
    await expectNoViolations(page, "data settings");
  });
}

test("the questionnaire step can be completed with the keyboard only", async ({ page }) => {
  await openApp(page);
  // Focus moves to the step heading; Tab reaches the first radio of the group.
  await expect(page.getByRole("heading", { name: "Доход" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: /^Фиксированная зарплата/ })).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Чистый доход в месяц", { exact: true })).toBeFocused();
  await page.keyboard.type("120000");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Шаг 2 из 4")).toBeVisible();
});
