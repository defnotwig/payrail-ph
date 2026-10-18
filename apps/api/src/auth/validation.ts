import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
export const money = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
export const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException("Invalid request input.");
  return result.data;
}
export function requiredIdempotency(value: unknown): string {
  return parseInput(
    z
      .string()
      .min(1)
      .max(128)
      .regex(/^[\x21-\x7E]+$/),
    value,
  );
}
export function pageLimit(value: unknown, maximum = 100): number {
  return parseInput(z.coerce.number().int().min(1).max(maximum).default(50), value);
}
