import { expect, type Page, test } from "@playwright/test";

// The e2e database is kept between local runs, so every test works with names of its own.
const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString().slice(-6)}`;

async function addEmployee(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Новый сотрудник").fill(name);
  await page.getByRole("button", { name: "Добавить" }).click();
  return page.getByRole("listitem").filter({ hasText: name });
}

test("adding an employee, timing a task and finding it in today's report", async ({ page }) => {
  const name = uniqueName("Сквозной Тест");
  const row = await addEmployee(page, name);

  await row.getByLabel(`Задача для сотрудника ${name}`).fill("Сквозная проверка");
  await row.getByRole("button", { name: "Начать" }).click();
  await expect(row.getByText("Сквозная проверка")).toBeVisible();
  await expect(row.getByText(/^00:00:0[1-9]$/)).toBeVisible(); // the clock ticks
  await row.getByRole("button", { name: "Остановить" }).click();
  await expect(row.getByRole("button", { name: "Начать" })).toBeVisible();

  await page.getByRole("link", { name: "Отчёт" }).click();
  await page.getByRole("button", { name: "Сегодня" }).click();
  // Scoped to this employee: other runs leave entries with the same task in the report.
  const employeeReport = page.locator("details").filter({ hasText: name });
  await expect(employeeReport.locator("summary")).toContainText("записей: 1");
  await employeeReport.locator("summary").click();
  await expect(employeeReport.getByText("Сквозная проверка")).toBeVisible();
});

test("a running timer with a long task fits a phone screen", async ({ page, isMobile }) => {
  test.skip(!isMobile, "only the phone layout can overflow this way");
  // Guards defect 6 in docs/ai-log.md: the row used to run 107 px past a 375 px screen.
  const name = uniqueName("Телефонный Тест");
  const row = await addEmployee(page, name);

  await row
    .getByLabel(`Задача для сотрудника ${name}`)
    .fill("Сверка накладных и звонки перевозчикам по вчерашним рейсам");
  await row.getByRole("button", { name: "Начать" }).click();
  await expect(row.getByRole("button", { name: "Остановить" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await row.getByRole("button", { name: "Остановить" }).click();
});
