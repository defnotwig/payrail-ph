import { describe, it, expect, vi, beforeEach } from "vitest";
import { MerchantKeysService } from "./merchant-keys.service";
import { MerchantWebhooksService } from "./merchant-webhooks.service";
import type { DatabasePool } from "../database/database.pool";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as crypto from "node:crypto";

describe("Merchant API Platform", () => {
  let keysService: MerchantKeysService;
  let webhooksService: MerchantWebhooksService;
  let mockDb: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    keysService = new MerchantKeysService(mockDb as unknown as DatabasePool);
    webhooksService = new MerchantWebhooksService(mockDb as unknown as DatabasePool);
  });

  describe("Merchant API Keys Security", () => {
    it("creates an API key and stores its SHA-256 hash, returning plaintext only once", async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: "key-1",
            merchant_id: "merchant_test",
            key_prefix: "sk_test_",
            name: "Backend Server Key",
            scopes: ["payments:read", "payments:write"],
            environment: "test",
            created_at: new Date(),
          },
        ],
      });

      const result = await keysService.createApiKey({
        merchantId: "merchant_test",
        name: "Backend Server Key",
      });

      expect(result.id).toBe("key-1");
      expect(result.apiKey).toMatch(/^sk_test_/);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payrail_private.merchant_api_keys"),
        expect.arrayContaining([
          "merchant_test",
          "sk_test_",
          expect.any(String),
          "Backend Server Key",
        ]),
      );

      // Verify that the hash passed to the database is indeed the SHA-256 of the returned apiKey
      const firstCall = mockDb.query.mock.calls[0];
      expect(firstCall).toBeDefined();
      const passedHash = (firstCall as [string, unknown[]])[1][2];
      const expectedHash = crypto.createHash("sha256").update(result.apiKey).digest("hex");
      expect(passedHash).toBe(expectedHash);
    });

    it("validates valid API key via SHA-256 hash lookup", async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: "key-1",
            merchant_id: "merchant_test",
            scopes: ["payments:read", "payments:write"],
            environment: "test",
          },
        ],
      });

      const validation = await keysService.validateApiKey("sk_test_valid_key_entropy");
      expect(validation.merchantId).toBe("merchant_test");
      expect(validation.scopes).toContain("payments:write");
    });

    it("throws UnauthorizedException on invalid or revoked API key", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Not found

      await expect(keysService.validateApiKey("sk_test_revoked")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("Outbound Webhook SSRF Defense & Signatures", () => {
    it("blocks cloud instance metadata endpoints (169.254.169.254)", () => {
      expect(() =>
        webhooksService.validateDestinationUrl("http://169.254.169.254/latest/meta-data"),
      ).toThrow(BadRequestException);
    });

    it("blocks loopback and localhost destinations in production mode", () => {
      expect(() =>
        webhooksService.validateDestinationUrl("https://localhost:8080/webhook"),
      ).toThrow(BadRequestException);

      expect(() =>
        webhooksService.validateDestinationUrl("https://127.0.0.1:4000/webhook"),
      ).toThrow(BadRequestException);
      for (const destination of [
        "https://[::1]/hook",
        "https://[::ffff:127.0.0.1]/hook",
        "https://10.0.0.2/hook",
        "https://172.31.0.5/hook",
        "https://192.168.1.2/hook",
        "https://user:pass@api.merchant.com/hook",
        "https://api.merchant.com:8443/hook",
      ])
        expect(() => webhooksService.validateDestinationUrl(destination)).toThrow(
          BadRequestException,
        );
    });

    it("allows valid public HTTPS destinations", () => {
      expect(() =>
        webhooksService.validateDestinationUrl("https://api.merchant.com/payrail/webhook"),
      ).not.toThrow();
    });

    it("signs outbound payloads with timestamp and HMAC-SHA256", () => {
      const payload = JSON.stringify({ event: "payment.succeeded", id: "evt_1" });
      const secret = "whsec_test_secret_key_12345";
      const timestamp = 1700000000;

      const signatureHeader = webhooksService.signPayload(payload, secret, timestamp);

      expect(signatureHeader).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);

      // Verify the signature manually
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(`1700000000.${payload}`)
        .digest("hex");

      expect(signatureHeader).toBe(`t=1700000000,v1=${expectedSig}`);
    });
  });
});
