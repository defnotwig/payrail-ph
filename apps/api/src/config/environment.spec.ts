import { describe, expect, it } from "vitest";
import { parseEnvironment } from "./environment";

describe("parseEnvironment", () => {
  it("uses the local API port by default", () => {
    const result = parseEnvironment({
      DATABASE_URL: "postgresql://payrail@127.0.0.1:55432/payrail_local",
      WEB_ORIGIN: "http://localhost:3000",
    });

    expect(result.API_PORT).toBe(4000);
  });

  it("rejects non-PostgreSQL URLs and invalid ports", () => {
    expect(() =>
      parseEnvironment({
        API_PORT: "70000",
        DATABASE_URL: "https://example.test/db",
        WEB_ORIGIN: "http://localhost:3000",
      }),
    ).toThrow();
  });

  it("requires a valid browser origin", () => {
    expect(() =>
      parseEnvironment({
        DATABASE_URL: "postgresql://payrail@127.0.0.1:55432/payrail_local",
        WEB_ORIGIN: "not a url",
      }),
    ).toThrow();
  });
});
