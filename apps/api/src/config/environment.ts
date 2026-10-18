import { z } from "zod";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol)),
  WEB_ORIGIN: z.string().url(),
  SUPABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => new URL(value).protocol === "https:" || new URL(value).hostname === "localhost",
    ),
  APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
  WEBHOOK_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  PAYMONGO_SECRET_KEY: z
    .string()
    .min(8)
    .regex(/^sk_test_/),
  PAYMONGO_WEBHOOK_SECRET: z
    .string()
    .min(8)
    .regex(/^whsk_test_/),
  PAYMENTS_MODE: z.enum(["test"]).default("test"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(input);

  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid API environment variables: ${fields.join(", ")}`);
  }

  return result.data;
}
