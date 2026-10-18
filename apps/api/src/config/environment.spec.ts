import { describe, expect, it } from "vitest";
import { parseEnvironment } from "./environment";

const validEnvironment = {
  DATABASE_URL: "postgresql://payrail@127.0.0.1:55432/payrail_local",
  WEB_ORIGIN: "http://localhost:3000",
  SUPABASE_URL: "https://identity.example.test",
  WEBHOOK_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  PAYMONGO_SECRET_KEY: "sk_test_placeholder",
  PAYMONGO_WEBHOOK_SECRET: "whsk_test_placeholder",
};

describe("parseEnvironment", () => {
  it("uses the local API port by default", () => {
    const result = parseEnvironment(validEnvironment);

    expect(result.API_PORT).toBe(4000);
  });

  it("rejects non-PostgreSQL URLs and invalid ports", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        API_PORT: "70000",
        DATABASE_URL: "https://example.test/db",
      }),
    ).toThrow();
  });

  it("requires a valid browser origin", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        DATABASE_URL: "postgresql://payrail@127.0.0.1:55432/payrail_local",
        WEB_ORIGIN: "not a url",
      }),
    ).toThrow();
  });

  it("requires Supabase identity, test provider secrets, and a strong webhook encryption key", () => {
    for (const invalid of [
      { ...validEnvironment, SUPABASE_URL: undefined },
      { ...validEnvironment, SUPABASE_URL: "http://identity.example.test" },
      { ...validEnvironment, PAYMONGO_WEBHOOK_SECRET: undefined },
      { ...validEnvironment, WEBHOOK_ENCRYPTION_KEY: "short" },
    ])
      expect(() => parseEnvironment(invalid)).toThrow();
  });
});
