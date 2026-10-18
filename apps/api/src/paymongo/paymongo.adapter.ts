import { Injectable, Logger, Optional } from "@nestjs/common";
import * as crypto from "node:crypto";

export interface QrPhPaymentResult {
  providerPaymentIntentId: string;
  providerPaymentMethodId: string;
  status: string;
  qrCodeUrl?: string | undefined;
  testUrl?: string | undefined;
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
  private readonly logger = new Logger(PayMongoAdapter.name);
  private readonly secretKey: string;
  private readonly baseUrl = "https://api.paymongo.com/v1";

  constructor(@Optional() secretKey?: string) {
    this.secretKey = secretKey || process.env.PAYMONGO_SECRET_KEY || "sk_test_placeholder";
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  async createQrPhPayment(
    amountMinor: bigint,
    currency = "PHP",
    description = "PayRail PH Test QR Payment",
  ): Promise<QrPhPaymentResult> {
    if (this.secretKey === "sk_test_placeholder") {
      this.logger.warn(
        "Using synthetic PayMongo QR Ph simulator (PAYMONGO_SECRET_KEY is placeholder)",
      );
      const mockPiId = `pi_mock_${crypto.randomBytes(12).toString("hex")}`;
      const mockPmId = `pm_mock_${crypto.randomBytes(12).toString("hex")}`;
      const mockTestToken = crypto.randomBytes(16).toString("hex");

      return {
        providerPaymentIntentId: mockPiId,
        providerPaymentMethodId: mockPmId,
        status: "awaiting_next_action",
        qrCodeUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        testUrl: `https://test.paymongo.com/qrph/${mockTestToken}`,
      };
    }

    // 1. Create PaymentIntent
    const piResponse = await fetch(`${this.baseUrl}/payment_intents`, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Number(amountMinor),
            currency,
            payment_method_allowed: ["qrph"],
            description,
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

    // 2. Create PaymentMethod
    const pmResponse = await fetch(`${this.baseUrl}/payment_methods`, {
      method: "POST",
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

    // 3. Attach PaymentMethod to PaymentIntent
    const attachResponse = await fetch(
      `${this.baseUrl}/payment_intents/${paymentIntentId}/attach`,
      {
        method: "POST",
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
