import {
  Injectable,
  Optional,
  ServiceUnavailableException,
  NotImplementedException,
} from "@nestjs/common";
import * as crypto from "node:crypto";

export interface QrPhPaymentResult {
  providerPaymentIntentId: string;
  providerPaymentMethodId: string;
  status: string;
  qrCodeUrl?: string | undefined;
  testUrl?: string | undefined;
}
export interface ProviderOperation {
  key: string;
  onProgress: (progress: {
    providerPaymentIntentId?: string;
    providerPaymentMethodId?: string;
  }) => Promise<void>;
}

interface PayMongoResource<T> {
  data: {
    id: string;
    type: string;
    attributes: T;
  };
}

interface PaymentIntentAttributes {
  status: string;
  next_action?: {
    type: string;
    code?: {
      type: string;
      image_url?: string;
      test_url?: string;
    };
  };
}

@Injectable()
export class PayMongoAdapter {
  private readonly secretKey: string;
  private readonly baseUrl = "https://api.paymongo.com/v1";

  readonly mode: "fixture" | "sandbox";
  readonly account: string;
  constructor(@Optional() secretKey?: string, @Optional() mode?: "fixture" | "sandbox") {
    this.secretKey = secretKey || process.env.PAYMONGO_SECRET_KEY || "sk_test_placeholder";
    this.mode = mode || (process.env.PAYMENTS_ADAPTER_MODE === "fixture" ? "fixture" : "sandbox");
    this.account = this.mode;
  }
  assertAvailable() {
    if (this.mode === "fixture") {
      if (
        process.env.NODE_ENV !== "test" &&
        (process.env.PAYRAIL_ALLOW_LOCAL_FIXTURES !== "1" ||
          !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.WEB_ORIGIN || "") ||
          process.env.VERCEL)
      )
        throw new ServiceUnavailableException("Fixtures require explicit local-only runtime");
    } else if (!this.secretKey.startsWith("sk_test_") || this.secretKey === "sk_test_placeholder")
      throw new ServiceUnavailableException("Qualified PayMongo test credentials are required");
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  async createQrPhPayment(
    amountMinor: bigint,
    currency = "PHP",
    description = "PayRail PH Test QR Payment",
    operation?: ProviderOperation,
  ): Promise<QrPhPaymentResult> {
    this.assertAvailable();
    if (amountMinor < 100n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER) || currency !== "PHP")
      throw new Error("Unsupported exact PHP amount: minimum is PHP 1.00 (100 minor units)");
    if (this.mode === "fixture") {
      const mockPiId = `pi_fixture_${crypto.randomBytes(12).toString("hex")}`;
      const mockPmId = `pm_fixture_${crypto.randomBytes(12).toString("hex")}`;
      const mockTestToken = crypto.randomBytes(16).toString("hex");
      await operation?.onProgress({
        providerPaymentIntentId: mockPiId,
        providerPaymentMethodId: mockPmId,
      });
      return {
        providerPaymentIntentId: mockPiId,
        providerPaymentMethodId: mockPmId,
        status: "awaiting_next_action",
        testUrl: `http://localhost/fixture/qrph/${mockTestToken}`,
      };
    }

    // 1. Create PaymentIntent
    const piHeaders: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (operation?.key) {
      piHeaders["Idempotency-Key"] = operation.key;
    }

    const piResponse = await fetch(`${this.baseUrl}/payment_intents`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: piHeaders,
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Number(amountMinor),
            currency,
            payment_method_allowed: ["qrph"],
            description,
            metadata: { payrail_operation_key: operation?.key },
          },
        },
      }),
    });

    if (!piResponse.ok) {
      const errorText = await piResponse.text();
      throw new Error(
        `PayMongo PaymentIntent creation failed (${piResponse.status}): ${errorText}`,
      );
    }

    const piData = (await piResponse.json()) as PayMongoResource<Record<string, unknown>>;
    const paymentIntentId = piData.data.id;
    await operation?.onProgress({ providerPaymentIntentId: paymentIntentId });

    // 2. Create PaymentMethod
    const pmResponse = await fetch(`${this.baseUrl}/payment_methods`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            type: "qrph",
          },
        },
      }),
    });

    if (!pmResponse.ok) {
      const errorText = await pmResponse.text();
      throw new Error(
        `PayMongo PaymentMethod creation failed (${pmResponse.status}): ${errorText}`,
      );
    }

    const pmData = (await pmResponse.json()) as PayMongoResource<Record<string, unknown>>;
    const paymentMethodId = pmData.data.id;
    await operation?.onProgress({
      providerPaymentIntentId: paymentIntentId,
      providerPaymentMethodId: paymentMethodId,
    });

    // 3. Attach PaymentMethod to PaymentIntent
    const attachResponse = await fetch(
      `${this.baseUrl}/payment_intents/${paymentIntentId}/attach`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId,
            },
          },
        }),
      },
    );

    if (!attachResponse.ok) {
      const errorText = await attachResponse.text();
      throw new Error(`PayMongo attach failed (${attachResponse.status}): ${errorText}`);
    }

    const attachData = (await attachResponse.json()) as PayMongoResource<PaymentIntentAttributes>;
    const nextAction = attachData.data.attributes.next_action;

    return {
      providerPaymentIntentId: paymentIntentId,
      providerPaymentMethodId: paymentMethodId,
      status: attachData.data.attributes.status,
      qrCodeUrl: nextAction?.code?.image_url,
      testUrl: nextAction?.code?.test_url,
    };
  }
  async createRefund(
    _providerPaymentId: string,
    _amountMinor: bigint,
    _reason: string,
    _operationKey: string,
  ): Promise<{ providerRefundId: string; state: "SUCCEEDED" | "PENDING" }> {
    this.assertAvailable();
    if (this.mode !== "fixture")
      throw new NotImplementedException(
        "Provider refund capability has not been qualified; no refund submitted",
      );
    return { providerRefundId: `ref_fixture_${crypto.randomUUID()}`, state: "SUCCEEDED" };
  }
  assertRefundAvailable() {
    this.assertAvailable();
    if (this.mode !== "fixture")
      throw new NotImplementedException("Provider refund capability has not been qualified");
  }

  static verifySignature(
    rawBody: Buffer | string,
    signatureHeader: string,
    webhookSecret: string,
  ): boolean {
    if (!signatureHeader || !webhookSecret) {
      return false;
    }

    const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) {
        acc[k.trim()] = v.trim();
      }
      return acc;
    }, {});

    const timestamp = parts.t;
    const expectedSig = parts.te || parts.li;

    if (!timestamp || !expectedSig) {
      return false;
    }
    if (
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^[0-9a-f]{64}$/.test(expectedSig)
    )
      return false;

    const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const payloadToSign = `${timestamp}.${bodyString}`;

    const computedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadToSign)
      .digest("hex");

    if (computedSig.length !== expectedSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(computedSig, "utf8"),
      Buffer.from(expectedSig, "utf8"),
    );
  }
}
