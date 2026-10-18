import { z } from "zod";

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol)),
  WEB_ORIGIN: z.string().url(),
  PAYMONGO_SECRET_KEY: z.string().default("sk_test_placeholder"),
  PAYMONGO_WEBHOOK_SECRET: z.string().default("whsk_test_placeholder"),
  PAYMENTS_MODE: z.enum(["test"]).default("test"),
  INTERNAL_SERVICE_SECRET: z.string().default("dev_internal_secret"),
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
