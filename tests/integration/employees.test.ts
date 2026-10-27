import { describe, expect, it } from "vitest";
import { employees } from "@/server/db/schema";
import { T0, useTrackingService } from "../helpers/test-context";

describe("employees", () => {
  const ctx = useTrackingService();

  it("adds an employee with a trimmed name and the current time", async () => {
    const employee = await ctx.service.addEmployee({ name: "  Алия Тестова  " });

    expect(employee).toEqual({ id: expect.any(Number), name: "Алия Тестова", createdAt: T0 });
  });

  it("lists employees alphabetically by Russian rules, none with a running timer", async () => {
    // Code point order would put Ё (U+0401) before А (U+0410).
    for (const name of ["Вера Образцова", "Ёлкина Мария", "Алия Тестова", "Борис Примеров"]) {
      await ctx.service.addEmployee({ name });
    }

    const list = await ctx.service.listEmployees();

    expect(list.map((employee) => employee.name)).toEqual([
      "Алия Тестова",
      "Борис Примеров",
      "Вера Образцова",
      "Ёлкина Мария",
    ]);
    expect(list.map((employee) => employee.runningEntry)).toEqual([null, null, null, null]);
  });

  it("rejects a blank name and stores nothing", async () => {
    await expect(ctx.service.addEmployee({ name: "   " })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Введите имя сотрудника",
    });
    expect(await ctx.db.select().from(employees)).toHaveLength(0);
  });

  it("accepts a name of 100 characters and rejects one of 101", async () => {
    await expect(ctx.service.addEmployee({ name: "Я".repeat(100) })).resolves.toMatchObject({
      name: "Я".repeat(100),
    });
    await expect(ctx.service.addEmployee({ name: "Я".repeat(101) })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Имя не длиннее 100 символов",
    });
  });
});

describe("employee input that is not a usable name", () => {
  const ctx = useTrackingService();

  it.each([
    ["only an invisible character", { name: "\u200b" }, "Имя должно содержать буквы или цифры"],
    ["only punctuation", { name: "..." }, "Имя должно содержать буквы или цифры"],
    ["not a string", { name: 5 }, "Введите имя сотрудника"],
    ["not an object", null, "Неверный формат запроса"],
  ])("rejects %s with a message in Russian", async (_, input, message) => {
    await expect(ctx.service.addEmployee(input as never)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message,
    });
  });
});
