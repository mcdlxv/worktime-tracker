import { z } from "zod";
import { ValidationError } from "./errors";

export const employeeInputSchema = z.object({
  name: z.string().trim().min(1, "Введите имя сотрудника").max(100, "Имя не длиннее 100 символов"),
});

/** Validates input against a schema; the first problem becomes a ValidationError. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? "Некорректные данные");
  }
  return result.data;
}
