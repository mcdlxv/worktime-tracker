import { z } from "zod";
import { ValidationError } from "./errors";

/** At least one letter or digit: trim() leaves invisible characters such as U+200B in place. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

const NOT_AN_OBJECT = { error: "Неверный формат запроса" };

export const employeeInputSchema = z.object(
  {
    name: z
      .string({ error: "Введите имя сотрудника" })
      .trim()
      .min(1, "Введите имя сотрудника")
      .max(100, "Имя не длиннее 100 символов")
      .regex(HAS_LETTER_OR_DIGIT, "Имя должно содержать буквы или цифры"),
  },
  NOT_AN_OBJECT,
);

export const startTimerInputSchema = z.object(
  {
    description: z
      .string({ error: "Опишите задачу" })
      .trim()
      .min(1, "Опишите задачу")
      .max(200, "Описание не длиннее 200 символов")
      .regex(HAS_LETTER_OR_DIGIT, "Опишите задачу"),
  },
  NOT_AN_OBJECT,
);

export const periodSchema = z
  .object({ from: z.number(), to: z.number() })
  .refine((period) => period.from < period.to, "Начало периода должно быть раньше конца");

/** Validates input against a schema; the first problem becomes a ValidationError. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Некорректные данные");
  }
  return result.data;
}
