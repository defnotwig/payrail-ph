import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ApiConfigurationError,
  isLocalhostUrl,
  resolveDemoMerchantApiKey,
  resolveInternalApiUrl,
} from "./server-api-config";

describe("server-api-config", () => {
  const originalEnv = { ...process.env };

  function setNodeEnv(val: string) {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.INTERNAL_API_URL;
    delete process.env.API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.DEMO_MERCHANT_API_KEY;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.APP_ENV;
    setNodeEnv("test");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isLocalhostUrl", () => {
    it("detects localhost and loopback IPs as localhost", () => {
      assert.strictEqual(isLocalhostUrl("http://localhost:4000"), true);
      assert.strictEqual(isLocalhostUrl("http://127.0.0.1:4000"), true);
      assert.strictEqual(isLocalhostUrl("http://0.0.0.0:4000"), true);
      assert.strictEqual(isLocalhostUrl("http://[::1]:4000"), true);
    });

    it("rejects non-https URLs as unsafe for production internal API", () => {
      assert.strictEqual(isLocalhostUrl("http://api.payrail.ph"), true);
    });

    it("accepts valid https URLs", () => {
      assert.strictEqual(isLocalhostUrl("https://payrail-ph-api.vercel.app"), false);
      assert.strictEqual(isLocalhostUrl("https://api.payrail.ph"), false);
    });
  });

  describe("resolveInternalApiUrl", () => {
    it("falls back to http://127.0.0.1:4000 in local development", () => {
      setNodeEnv("development");
      const url = resolveInternalApiUrl();
      assert.strictEqual(url, "http://127.0.0.1:4000");
    });

    it("throws ApiConfigurationError in production if INTERNAL_API_URL is missing", () => {
      process.env.APP_ENV = "production";
      setNodeEnv("production");
      assert.throws(() => resolveInternalApiUrl(), ApiConfigurationError);
      assert.throws(() => resolveInternalApiUrl(), /INTERNAL_API_URL is not configured/);
    });

    it("throws ApiConfigurationError in production if INTERNAL_API_URL points to localhost", () => {
      process.env.VERCEL = "1";
      process.env.INTERNAL_API_URL = "http://localhost:4000";
      assert.throws(() => resolveInternalApiUrl(), ApiConfigurationError);
      assert.throws(() => resolveInternalApiUrl(), /Invalid INTERNAL_API_URL/);
    });

    it("throws ApiConfigurationError in production if INTERNAL_API_URL is non-HTTPS", () => {
      process.env.VERCEL = "1";
      process.env.INTERNAL_API_URL = "http://payrail-api.railway.internal";
      assert.throws(() => resolveInternalApiUrl(), ApiConfigurationError);
    });

    it("returns sanitized URL in production when valid HTTPS endpoint is provided", () => {
      process.env.VERCEL = "1";
      process.env.INTERNAL_API_URL = "https://payrail-ph-api.vercel.app///";
      const url = resolveInternalApiUrl();
      assert.strictEqual(url, "https://payrail-ph-api.vercel.app");
    });
  });

  describe("resolveDemoMerchantApiKey", () => {
    it("returns default key in local development", () => {
      setNodeEnv("development");
      const key = resolveDemoMerchantApiKey();
      assert.strictEqual(key, "sk_test_payrail_demo_merchant_default_9f8e7d6c5b4a");
    });

    it("throws ApiConfigurationError in production if DEMO_MERCHANT_API_KEY is unconfigured", () => {
      setNodeEnv("production");
      process.env.APP_ENV = "production";
      assert.throws(() => resolveDemoMerchantApiKey(), ApiConfigurationError);
    });

    it("returns configured key in production", () => {
      setNodeEnv("production");
      process.env.APP_ENV = "production";
      process.env.DEMO_MERCHANT_API_KEY = "sk_test_custom_prod_key_123456";
      const key = resolveDemoMerchantApiKey();
      assert.strictEqual(key, "sk_test_custom_prod_key_123456");
    });
  });
});
