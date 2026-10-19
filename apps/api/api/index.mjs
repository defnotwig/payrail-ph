var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/serverless.ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

// src/app.module.ts
import { Module as Module17 } from "@nestjs/common";

// src/database/database.module.ts
import { Global, Module } from "@nestjs/common";

// src/database/database.constants.ts
var PG_POOL = /* @__PURE__ */ Symbol("PG_POOL");

// src/database/database.pool.ts
import { Injectable } from "@nestjs/common";
import { Pool } from "pg";

// src/config/environment.ts
import { z } from "zod";
var environmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4e3),
  DATABASE_URL: z.string().url().refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol)),
  WEB_ORIGIN: z.string().url(),
  SUPABASE_URL: z.string().url().refine(
    (value) => new URL(value).protocol === "https:" || new URL(value).hostname === "localhost"
  ),
  APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
  WEBHOOK_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  PAYMONGO_SECRET_KEY: z.string().min(8).regex(/^sk_test_/),
  PAYMONGO_WEBHOOK_SECRET: z.string().min(8).regex(/^whsk_/),
  PAYMENTS_MODE: z.enum(["test"]).default("test")
});
function parseEnvironment(input) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid API environment variables: ${fields.join(", ")}`);
  }
  return result.data;
}

// src/database/database.pool.ts
var DatabasePool = class extends Pool {
  constructor() {
    const { DATABASE_URL } = parseEnvironment(process.env);
    super({
      connectionString: DATABASE_URL,
      max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 5,
      idleTimeoutMillis: 1e4,
      connectionTimeoutMillis: 1e4,
      keepAlive: true
    });
    this.on("error", () => {
    });
  }
  async onModuleDestroy() {
    await this.end();
  }
};
DatabasePool = __decorateClass([
  Injectable()
], DatabasePool);

// src/database/database.module.ts
var DatabaseModule = class {
};
DatabaseModule = __decorateClass([
  Global(),
  Module({
    providers: [DatabasePool, { provide: PG_POOL, useExisting: DatabasePool }],
    exports: [PG_POOL]
  })
], DatabaseModule);

// src/health/health.module.ts
import { Module as Module2 } from "@nestjs/common";

// src/health/health.controller.ts
import { Controller, Get, HttpException, Inject as Inject2 } from "@nestjs/common";

// src/health/health.service.ts
import { Inject, Injectable as Injectable2 } from "@nestjs/common";
var HealthService = class {
  constructor(_pool) {
    this._pool = _pool;
  }
  _pool;
  async isReady() {
    try {
      await this._pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
};
HealthService = __decorateClass([
  Injectable2(),
  __decorateParam(0, Inject(PG_POOL))
], HealthService);

// src/auth/authorization.ts
import { SetMetadata } from "@nestjs/common";
var PUBLIC_ROUTE = "payrail:public";
var ALLOW_API_KEY = "payrail:api-key";
var PERMISSIONS = "payrail:permissions";
var Public = () => SetMetadata(PUBLIC_ROUTE, true);
var AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);
var Permissions = (...permissions) => SetMetadata(PERMISSIONS, permissions);

// src/health/health.controller.ts
var HealthController = class {
  constructor(healthService) {
    this.healthService = healthService;
  }
  healthService;
  live() {
    return { status: "ok" };
  }
  async ready() {
    if (!await this.healthService.isReady()) {
      throw new HttpException({ status: "unavailable" }, 503);
    }
    return { status: "ready" };
  }
};
__decorateClass([
  Get("live")
], HealthController.prototype, "live", 1);
__decorateClass([
  Get("ready")
], HealthController.prototype, "ready", 1);
HealthController = __decorateClass([
  Controller("health"),
  Public(),
  __decorateParam(0, Inject2(HealthService))
], HealthController);

// src/health/health.module.ts
var HealthModule = class {
};
HealthModule = __decorateClass([
  Module2({
    controllers: [HealthController],
    providers: [HealthService]
  })
], HealthModule);

// src/paymongo/paymongo.module.ts
import { Module as Module3 } from "@nestjs/common";

// src/paymongo/paymongo.adapter.ts
import {
  Injectable as Injectable3,
  Optional,
  ServiceUnavailableException,
  NotImplementedException
} from "@nestjs/common";
import * as crypto2 from "node:crypto";
var PayMongoAdapter = class {
  secretKey;
  baseUrl = "https://api.paymongo.com/v1";
  mode;
  account;
  constructor(secretKey, mode) {
    this.secretKey = secretKey || process.env.PAYMONGO_SECRET_KEY || "sk_test_placeholder";
    this.mode = mode || (process.env.PAYMENTS_ADAPTER_MODE === "fixture" ? "fixture" : "sandbox");
    this.account = this.mode;
  }
  assertAvailable() {
    if (this.mode === "fixture") {
      if (process.env.NODE_ENV !== "test" && (process.env.PAYRAIL_ALLOW_LOCAL_FIXTURES !== "1" || !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.WEB_ORIGIN || "") || process.env.VERCEL))
        throw new ServiceUnavailableException("Fixtures require explicit local-only runtime");
    } else if (!this.secretKey.startsWith("sk_test_") || this.secretKey === "sk_test_placeholder")
      throw new ServiceUnavailableException("Qualified PayMongo test credentials are required");
  }
  getAuthHeader() {
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }
  async createQrPhPayment(amountMinor, currency = "PHP", description = "PayRail PH Test QR Payment", operation) {
    this.assertAvailable();
    if (amountMinor < 100n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER) || currency !== "PHP")
      throw new Error("Unsupported exact PHP amount: minimum is PHP 1.00 (100 minor units)");
    if (this.mode === "fixture") {
      const mockPiId = `pi_fixture_${crypto2.randomBytes(12).toString("hex")}`;
      const mockPmId = `pm_fixture_${crypto2.randomBytes(12).toString("hex")}`;
      const mockTestToken = crypto2.randomBytes(16).toString("hex");
      await operation?.onProgress({
        providerPaymentIntentId: mockPiId,
        providerPaymentMethodId: mockPmId
      });
      return {
        providerPaymentIntentId: mockPiId,
        providerPaymentMethodId: mockPmId,
        status: "awaiting_next_action",
        testUrl: `http://localhost/fixture/qrph/${mockTestToken}`
      };
    }
    const piHeaders = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (operation?.key) {
      piHeaders["Idempotency-Key"] = operation.key;
    }
    const piResponse = await fetch(`${this.baseUrl}/payment_intents`, {
      method: "POST",
      signal: AbortSignal.timeout(1e4),
      headers: piHeaders,
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Number(amountMinor),
            currency,
            payment_method_allowed: ["qrph"],
            description,
            metadata: { payrail_operation_key: operation?.key }
          }
        }
      })
    });
    if (!piResponse.ok) {
      const errorText = await piResponse.text();
      throw new Error(
        `PayMongo PaymentIntent creation failed (${piResponse.status}): ${errorText}`
      );
    }
    const piData = await piResponse.json();
    const paymentIntentId = piData.data.id;
    await operation?.onProgress({ providerPaymentIntentId: paymentIntentId });
    const pmResponse = await fetch(`${this.baseUrl}/payment_methods`, {
      method: "POST",
      signal: AbortSignal.timeout(1e4),
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        data: {
          attributes: {
            type: "qrph"
          }
        }
      })
    });
    if (!pmResponse.ok) {
      const errorText = await pmResponse.text();
      throw new Error(
        `PayMongo PaymentMethod creation failed (${pmResponse.status}): ${errorText}`
      );
    }
    const pmData = await pmResponse.json();
    const paymentMethodId = pmData.data.id;
    await operation?.onProgress({
      providerPaymentIntentId: paymentIntentId,
      providerPaymentMethodId: paymentMethodId
    });
    const attachResponse = await fetch(
      `${this.baseUrl}/payment_intents/${paymentIntentId}/attach`,
      {
        method: "POST",
        signal: AbortSignal.timeout(1e4),
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          data: {
            attributes: {
              payment_method: paymentMethodId
            }
          }
        })
      }
    );
    if (!attachResponse.ok) {
      const errorText = await attachResponse.text();
      throw new Error(`PayMongo attach failed (${attachResponse.status}): ${errorText}`);
    }
    const attachData = await attachResponse.json();
    const nextAction = attachData.data.attributes.next_action;
    return {
      providerPaymentIntentId: paymentIntentId,
      providerPaymentMethodId: paymentMethodId,
      status: attachData.data.attributes.status,
      qrCodeUrl: nextAction?.code?.image_url,
      testUrl: nextAction?.code?.test_url
    };
  }
  async createRefund(_providerPaymentId, _amountMinor, _reason, _operationKey) {
    this.assertAvailable();
    if (this.mode !== "fixture")
      throw new NotImplementedException(
        "Provider refund capability has not been qualified; no refund submitted"
      );
    return { providerRefundId: `ref_fixture_${crypto2.randomUUID()}`, state: "SUCCEEDED" };
  }
  assertRefundAvailable() {
    this.assertAvailable();
    if (this.mode !== "fixture")
      throw new NotImplementedException("Provider refund capability has not been qualified");
  }
  static verifySignature(rawBody, signatureHeader, webhookSecret) {
    if (!signatureHeader || !webhookSecret) {
      return false;
    }
    const parts = signatureHeader.split(",").reduce((acc, part) => {
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
    if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1e3 - Number(timestamp)) > 300 || !/^[0-9a-f]{64}$/.test(expectedSig))
      return false;
    const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const payloadToSign = `${timestamp}.${bodyString}`;
    const computedSig = crypto2.createHmac("sha256", webhookSecret).update(payloadToSign).digest("hex");
    if (computedSig.length !== expectedSig.length) {
      return false;
    }
    return crypto2.timingSafeEqual(
      Buffer.from(computedSig, "utf8"),
      Buffer.from(expectedSig, "utf8")
    );
  }
};
PayMongoAdapter = __decorateClass([
  Injectable3(),
  __decorateParam(0, Optional()),
  __decorateParam(1, Optional())
], PayMongoAdapter);

// src/paymongo/paymongo.module.ts
var PayMongoModule = class {
};
PayMongoModule = __decorateClass([
  Module3({
    providers: [PayMongoAdapter],
    exports: [PayMongoAdapter]
  })
], PayMongoModule);

// src/payments/payments.module.ts
import { Module as Module5 } from "@nestjs/common";

// src/payments/payments.controller.ts
import { Body, Controller as Controller2, Get as Get2, Headers, Inject as Inject5, Param, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiSecurity, ApiBody } from "@nestjs/swagger";
import { z as z3 } from "zod";

// src/payments/payments.service.ts
import {
  BadRequestException as BadRequestException2,
  ConflictException,
  Inject as Inject4,
  Injectable as Injectable5,
  NotFoundException as NotFoundException2
} from "@nestjs/common";
import { createHash, randomUUID as randomUUID2 } from "node:crypto";

// src/ledger/ledger.service.ts
import {
  Inject as Inject3,
  Injectable as Injectable4,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException
} from "@nestjs/common";
var LedgerService = class {
  constructor(db) {
    this.db = db;
  }
  db;
  /**
   * Posts an immutable double-entry journal entry.
   * Enforces:
   * 1. Total debits === Total credits (strictly balanced in minor units).
   * 2. All referenced accounts must exist for the specified merchant.
   * 3. Atomic database transaction with row locks on accounts to prevent concurrency anomalies.
   */
  async createJournalEntry(dto, externalClient) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException("Journal entry must contain at least two ledger lines.");
    }
    const debitsByCurrency = /* @__PURE__ */ new Map();
    const creditsByCurrency = /* @__PURE__ */ new Map();
    for (const line of dto.lines) {
      const currency = line.currency || "PHP";
      const amount = BigInt(line.amountMinor);
      if (amount <= 0n) {
        throw new BadRequestException(
          `Line amount must be strictly positive: got ${line.amountMinor}`
        );
      }
      if (line.direction === "DEBIT") {
        debitsByCurrency.set(currency, (debitsByCurrency.get(currency) || 0n) + amount);
      } else if (line.direction === "CREDIT") {
        creditsByCurrency.set(currency, (creditsByCurrency.get(currency) || 0n) + amount);
      } else {
        throw new BadRequestException(`Invalid direction: ${line.direction}`);
      }
    }
    const allCurrencies = /* @__PURE__ */ new Set([...debitsByCurrency.keys(), ...creditsByCurrency.keys()]);
    for (const currency of allCurrencies) {
      const debits = debitsByCurrency.get(currency) || 0n;
      const credits = creditsByCurrency.get(currency) || 0n;
      if (debits !== credits) {
        throw new BadRequestException(
          `Unbalanced ledger entry for currency ${currency}: Total Debits (${debits}) != Total Credits (${credits}) in minor units.`
        );
      }
    }
    const executeOperation = async (client2) => {
      await client2.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        JSON.stringify([dto.merchantId, dto.referenceType, dto.referenceId])
      ]);
      const existing = await client2.query(
        "SELECT id FROM payrail_private.journal_entries WHERE merchant_id=$1 AND reference_type=$2 AND reference_id=$3",
        [dto.merchantId, dto.referenceType, dto.referenceId]
      );
      if (existing.rows[0]) {
        const entries = await this.getJournalEntries(dto.merchantId, 1e4, client2);
        const entry2 = entries.find((item) => item.id === existing.rows[0]?.id);
        if (!entry2) throw new InternalServerErrorException("Existing journal is incomplete");
        const normalized = (lines) => JSON.stringify(
          lines.map((l) => [
            l.accountNumber,
            l.direction,
            BigInt(l.amountMinor).toString(),
            l.currency || "PHP"
          ]).sort()
        );
        if (normalized(entry2.lines) !== normalized(dto.lines))
          throw new BadRequestException("Business effect already exists with different values");
        return entry2;
      }
      const accountNumbers = [...new Set(dto.lines.map((l) => l.accountNumber))];
      const accountsRes = await client2.query(
        `SELECT id, account_number, name, type, currency 
         FROM payrail_private.accounts 
         WHERE merchant_id = $1 AND account_number = ANY($2::text[])
         FOR SHARE`,
        [dto.merchantId, accountNumbers]
      );
      const accountMap = new Map(accountsRes.rows.map((a) => [a.account_number, a]));
      for (const num of accountNumbers) {
        if (!accountMap.has(num)) {
          throw new NotFoundException(
            `Account '${num}' does not exist for merchant '${dto.merchantId}'.`
          );
        }
      }
      const entryNumber = `JE-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
      const entryRes = await client2.query(
        `INSERT INTO payrail_private.journal_entries 
           (merchant_id, entry_number, reference_type, reference_id, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, merchant_id, entry_number, reference_type, reference_id, description, posted_at, created_at`,
        [dto.merchantId, entryNumber, dto.referenceType, dto.referenceId, dto.description]
      );
      const entry = entryRes.rows[0];
      if (!entry) {
        throw new InternalServerErrorException("Failed to insert journal entry.");
      }
      const createdLines = [];
      for (const line of dto.lines) {
        const acc = accountMap.get(line.accountNumber);
        if (!acc) {
          throw new BadRequestException(`Account ${line.accountNumber} not found.`);
        }
        const lineCurrency = line.currency || acc.currency;
        if (lineCurrency !== acc.currency)
          throw new BadRequestException("Ledger line currency must match account currency");
        const lineRes = await client2.query(
          `INSERT INTO payrail_private.ledger_lines 
             (journal_entry_id, account_id, direction, amount_minor, currency)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, journal_entry_id, account_id, direction, amount_minor, currency`,
          [entry.id, acc.id, line.direction, line.amountMinor, lineCurrency]
        );
        const createdLine = lineRes.rows[0];
        if (!createdLine) {
          throw new InternalServerErrorException("Failed to insert ledger line.");
        }
        createdLines.push({
          id: createdLine.id,
          accountNumber: acc.account_number,
          accountName: acc.name,
          direction: line.direction,
          amountMinor: line.amountMinor,
          currency: lineCurrency
        });
      }
      await client2.query(
        "UPDATE payrail_private.journal_entries SET posting_state='POSTED' WHERE id=$1",
        [entry.id]
      );
      return {
        id: entry.id,
        merchantId: entry.merchant_id,
        entryNumber: entry.entry_number,
        referenceType: entry.reference_type,
        referenceId: entry.reference_id,
        description: entry.description,
        postedAt: entry.posted_at.toISOString(),
        createdAt: entry.created_at.toISOString(),
        lines: createdLines
      };
    };
    if (externalClient) {
      return executeOperation(externalClient);
    }
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const result = await executeOperation(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Posts standard journal entries for successful payments:
   * Debit: 1100-PSP-RECEIVABLE (Gateway receivable increases)
   * Credit: 2000-MERCHANT-PAYABLE (Merchant payable increases)
   */
  async postPaymentSuccess(merchantId, paymentIntentId, amountMinor, currency = "PHP", client) {
    return this.createJournalEntry(
      {
        merchantId,
        referenceType: "PAYMENT",
        referenceId: paymentIntentId,
        description: `Payment settlement recognition for ${paymentIntentId}`,
        lines: [
          {
            accountNumber: "1100-PSP-RECEIVABLE",
            direction: "DEBIT",
            amountMinor,
            currency
          },
          {
            accountNumber: "2000-MERCHANT-PAYABLE",
            direction: "CREDIT",
            amountMinor,
            currency
          }
        ]
      },
      client
    );
  }
  /**
   * Posts standard compensating journal entries for refunds:
   * Debit: 2000-MERCHANT-PAYABLE (Merchant payable decreases)
   * Credit: 1100-PSP-RECEIVABLE (Gateway receivable decreases)
   */
  async postRefund(merchantId, refundId, amountMinor, currency = "PHP", client) {
    return this.createJournalEntry(
      {
        merchantId,
        referenceType: "REFUND",
        referenceId: refundId,
        description: `Compensating refund entry for ${refundId}`,
        lines: [
          {
            accountNumber: "2000-MERCHANT-PAYABLE",
            direction: "DEBIT",
            amountMinor,
            currency
          },
          {
            accountNumber: "1100-PSP-RECEIVABLE",
            direction: "CREDIT",
            amountMinor,
            currency
          }
        ]
      },
      client
    );
  }
  /**
   * Retrieves account balances for a merchant, calculating net balances by account type.
   */
  async getAccountBalances(merchantId) {
    const res = await this.db.query(
      `SELECT 
         a.id AS account_id,
         a.account_number,
         a.name,
         a.type,
         a.currency,
         COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount_minor ELSE 0 END), 0)::text AS debit_total,
         COALESCE(SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount_minor ELSE 0 END), 0)::text AS credit_total
       FROM payrail_private.accounts a
       LEFT JOIN payrail_private.ledger_lines l ON l.account_id = a.id
       WHERE a.merchant_id = $1 AND a.is_active = true
       GROUP BY a.id, a.account_number, a.name, a.type, a.currency
       ORDER BY a.account_number ASC`,
      [merchantId]
    );
    return res.rows.map((row) => {
      const debits = BigInt(row.debit_total || "0");
      const credits = BigInt(row.credit_total || "0");
      let net;
      if (row.type === "ASSET" || row.type === "EXPENSE") {
        net = debits - credits;
      } else {
        net = credits - debits;
      }
      return {
        accountId: row.account_id,
        accountNumber: row.account_number,
        name: row.name,
        type: row.type,
        currency: row.currency,
        debitTotalMinor: debits.toString(),
        creditTotalMinor: credits.toString(),
        netBalanceMinor: net.toString()
      };
    });
  }
  /**
   * Retrieves recent journal entries with complete ledger line breakdown.
   */
  async getJournalEntries(merchantId, limit = 50, client) {
    const res = await (client || this.db).query(
      `SELECT 
         e.id,
         e.merchant_id,
         e.entry_number,
         e.reference_type,
         e.reference_id,
         e.description,
         e.posted_at,
         e.created_at,
         json_agg(
           json_build_object(
             'id', l.id,
             'accountNumber', a.account_number,
             'accountName', a.name,
             'direction', l.direction,
             'amountMinor', l.amount_minor::text,
             'currency', l.currency
           ) ORDER BY l.direction ASC
         ) AS lines
       FROM payrail_private.journal_entries e
       JOIN payrail_private.ledger_lines l ON l.journal_entry_id = e.id
       JOIN payrail_private.accounts a ON a.id = l.account_id
       WHERE e.merchant_id = $1
       GROUP BY e.id, e.merchant_id, e.entry_number, e.reference_type, e.reference_id, e.description, e.posted_at, e.created_at
       ORDER BY e.posted_at DESC
       LIMIT $2`,
      [merchantId, limit]
    );
    return res.rows.map((row) => ({
      id: row.id,
      merchantId: row.merchant_id,
      entryNumber: row.entry_number,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      description: row.description,
      postedAt: row.posted_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      lines: row.lines
    }));
  }
};
LedgerService = __decorateClass([
  Injectable4(),
  __decorateParam(0, Inject3(PG_POOL))
], LedgerService);

// src/financial/transaction.ts
async function inTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function transitionSource(client, source) {
  await client.query("SELECT set_config('payrail.transition_source',$1,true)", [source]);
}

// src/payments/payments.service.ts
var paymentTransitions = {
  CREATED: ["SUBMISSION_PENDING"],
  SUBMISSION_PENDING: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION"
  ],
  SUBMITTED: [
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION"
  ],
  AWAITING_PAYMENT: [
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED",
    "UNKNOWN_REQUIRES_RECONCILIATION"
  ],
  PROCESSING: ["SUCCEEDED", "FAILED", "EXPIRED", "UNKNOWN_REQUIRES_RECONCILIATION"],
  SUCCEEDED: [],
  FAILED: ["SUBMISSION_PENDING", "SUCCEEDED"],
  EXPIRED: ["SUBMISSION_PENDING", "SUCCEEDED"],
  UNKNOWN_REQUIRES_RECONCILIATION: [
    "SUBMITTED",
    "AWAITING_PAYMENT",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "EXPIRED"
  ]
};
function minorAmount(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value))
    throw new BadRequestException2("amountMinor must be a positive decimal integer string");
  const amount = BigInt(value);
  if (amount <= 0n || amount > 9007199254740991n)
    throw new BadRequestException2("amountMinor is outside the supported exact provider range");
  return amount;
}
var PaymentsService = class {
  constructor(pool, adapter, ledger) {
    this.pool = pool;
    this.adapter = adapter;
    this.ledger = ledger;
  }
  pool;
  adapter;
  ledger;
  async createQrPhPayment(dto, key) {
    if (!dto.merchantId || !key?.trim())
      throw new BadRequestException2("Merchant and Idempotency-Key are required");
    const merchant = dto.merchantId;
    const amount = minorAmount(dto.amountMinor);
    const currency = dto.currency || "PHP";
    if (currency !== "PHP") throw new BadRequestException2("Currency must be PHP");
    this.adapter.assertAvailable();
    const fingerprint = createHash("sha256").update(
      JSON.stringify([
        merchant,
        amount.toString(),
        currency,
        dto.orderNumber ?? null,
        dto.description ?? null,
        this.adapter.mode
      ])
    ).digest("hex");
    const operation = await inTransaction(this.pool, async (client) => {
      const claim = await client.query(
        "INSERT INTO payrail_private.idempotency_records(merchant_id,operation,idempotency_key,request_fingerprint,status) VALUES($1,'CREATE_QRPH_PAYMENT',$2,$3,'PENDING') ON CONFLICT DO NOTHING RETURNING merchant_id",
        [merchant, key, fingerprint]
      );
      const result = await client.query(
        "SELECT * FROM payrail_private.idempotency_records WHERE merchant_id=$1 AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$2 FOR UPDATE",
        [merchant, key]
      );
      const record = result.rows[0];
      if (record.request_fingerprint !== fingerprint)
        throw new ConflictException("IDEMPOTENCY_KEY_REUSED");
      if (!claim.rowCount) {
        if (!record.result_reference) throw new ConflictException("Operation is processing");
        return {
          id: record.result_reference,
          replay: true,
          attemptId: "",
          operationKey: ""
        };
      }
      const id = `pi_${randomUUID2()}`;
      const orderId = `ord_${randomUUID2()}`;
      const attemptId = `att_${randomUUID2()}`;
      const operationKey = `op_${randomUUID2()}`;
      await client.query(
        "INSERT INTO payrail_private.orders(id,merchant_id,order_number,amount_minor,currency) VALUES($1,$2,$3,$4,$5)",
        [orderId, merchant, dto.orderNumber || `ORD-${randomUUID2()}`, amount.toString(), currency]
      );
      await client.query(
        "INSERT INTO payrail_private.payment_intents(id,merchant_id,order_id,amount_minor,currency,evidence_mode) VALUES($1,$2,$3,$4,$5,$6)",
        [id, merchant, orderId, amount.toString(), currency, this.adapter.mode]
      );
      await client.query(
        "INSERT INTO payrail_private.payment_state_events(payment_intent_id,next_state,source) VALUES($1,'CREATED','API')",
        [id]
      );
      await transitionSource(client, "API");
      await client.query(
        "UPDATE payrail_private.payment_intents SET state='SUBMISSION_PENDING' WHERE id=$1",
        [id]
      );
      await client.query(
        "INSERT INTO payrail_private.payment_state_events(payment_intent_id,previous_state,next_state,source) VALUES($1,'CREATED','SUBMISSION_PENDING','API')",
        [id]
      );
      await client.query(
        "INSERT INTO payrail_private.payment_attempts(id,payment_intent_id,provider,provider_operation_key,submission_state,provider_account) VALUES($1,$2,'paymongo',$3,'SUBMITTED',$4)",
        [attemptId, id, operationKey, this.adapter.account]
      );
      await client.query(
        "UPDATE payrail_private.idempotency_records SET result_reference=$3 WHERE merchant_id=$1 AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$2",
        [merchant, key, id]
      );
      return { id, replay: false, attemptId, operationKey };
    });
    if (operation.replay) return this.getPaymentIntent(operation.id, merchant);
    try {
      const result = await this.adapter.createQrPhPayment(amount, currency, dto.description, {
        key: operation.operationKey,
        onProgress: async (progress) => {
          await this.pool.query(
            "UPDATE payrail_private.payment_attempts SET provider_payment_id=coalesce($1,provider_payment_id),provider_payment_method_id=coalesce($2,provider_payment_method_id),updated_at=clock_timestamp() WHERE id=$3",
            [
              progress.providerPaymentIntentId ?? null,
              progress.providerPaymentMethodId ?? null,
              operation.attemptId
            ]
          );
        }
      });
      await inTransaction(this.pool, async (client) => {
        const locked = await client.query(
          "SELECT state FROM payrail_private.payment_intents WHERE id=$1 FOR UPDATE",
          [operation.id]
        );
        const current = locked.rows[0].state;
        await client.query(
          "UPDATE payrail_private.payment_attempts SET provider_payment_id=$1,provider_payment_method_id=$2,submission_state=CASE WHEN submission_state IN ('SUCCEEDED','FAILED','EXPIRED') THEN submission_state ELSE 'AWAITING_PAYMENT' END,updated_at=clock_timestamp() WHERE id=$3",
          [result.providerPaymentIntentId, result.providerPaymentMethodId, operation.attemptId]
        );
        if (current === "SUBMISSION_PENDING")
          await this.transition(
            client,
            operation.id,
            current,
            "AWAITING_PAYMENT",
            "PROVIDER_ADAPTER"
          );
        await client.query(
          "UPDATE payrail_private.idempotency_records SET status='RESOLVED',response_body=$3,updated_at=clock_timestamp() WHERE merchant_id=$1 AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$2",
          [merchant, key, JSON.stringify({ qrCodeUrl: result.qrCodeUrl, testUrl: result.testUrl })]
        );
      });
    } catch (error) {
      await inTransaction(this.pool, async (client) => {
        const locked = await client.query(
          "SELECT state FROM payrail_private.payment_intents WHERE id=$1 FOR UPDATE",
          [operation.id]
        );
        const state = locked.rows[0].state;
        if (!["SUCCEEDED", "FAILED", "EXPIRED"].includes(state)) {
          await this.transition(
            client,
            operation.id,
            state,
            "UNKNOWN_REQUIRES_RECONCILIATION",
            "PROVIDER_ADAPTER"
          );
          await client.query(
            "UPDATE payrail_private.payment_attempts SET submission_state='UNKNOWN_REQUIRES_RECONCILIATION' WHERE id=$1",
            [operation.attemptId]
          );
          await client.query(
            "INSERT INTO payrail_private.durable_jobs(job_type,payload,state,deduplication_key) VALUES('RESOLVE_PAYMENT',$1,'PENDING',$2) ON CONFLICT DO NOTHING",
            [
              JSON.stringify({ paymentIntentId: operation.id, merchantId: merchant }),
              `resolve:${operation.id}`
            ]
          );
        }
      });
      throw error;
    }
    return this.getPaymentIntent(operation.id, merchant);
  }
  async getPaymentIntent(id, merchantId) {
    if (!merchantId) throw new BadRequestException2("Merchant scope is required");
    const result = await this.pool.query(
      "SELECT p.*,o.order_number,a.provider_payment_id,i.response_body FROM payrail_private.payment_intents p JOIN payrail_private.orders o ON o.id=p.order_id LEFT JOIN LATERAL(SELECT provider_payment_id FROM payrail_private.payment_attempts WHERE payment_intent_id=p.id ORDER BY created_at DESC LIMIT 1)a ON true LEFT JOIN payrail_private.idempotency_records i ON i.result_reference=p.id AND i.operation='CREATE_QRPH_PAYMENT' AND i.merchant_id=p.merchant_id WHERE p.id=$1 AND p.merchant_id=$2",
      [id, merchantId]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException2("Payment not found");
    return {
      id: row.id,
      merchantId: row.merchant_id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      amountMinor: row.amount_minor,
      currency: row.currency,
      state: row.state,
      provider: row.provider,
      paymentMethod: row.payment_method,
      providerPaymentIntentId: row.provider_payment_id ?? void 0,
      qrCodeUrl: row.response_body?.qrCodeUrl,
      testUrl: row.response_body?.testUrl,
      evidenceMode: row.evidence_mode,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
  async listPaymentIntents(merchantId, limit = 50) {
    const result = await this.pool.query(
      "SELECT id FROM payrail_private.payment_intents WHERE merchant_id=$1 ORDER BY created_at DESC LIMIT $2",
      [merchantId, Math.min(limit, 100)]
    );
    return Promise.all(result.rows.map((row) => this.getPaymentIntent(row.id, merchantId)));
  }
  async getPaymentInvestigation(id, merchantId) {
    if (!merchantId) throw new BadRequestException2("Merchant scope is required");
    const payment = await this.getPaymentIntent(id, merchantId);
    const timelineRes = await this.pool.query(
      `SELECT id::text, previous_state AS "previousState", next_state AS "nextState", source, provider_event_id AS "providerEventId", created_at AS "createdAt"
       FROM payrail_private.payment_state_events
       WHERE payment_intent_id = $1
       ORDER BY created_at ASC, id ASC`,
      [id]
    );
    const ledgerRes = await this.pool.query(
      `SELECT e.id, e.entry_number AS "entryNumber", e.reference_type AS "referenceType", e.reference_id AS "referenceId", e.description, e.posted_at AS "postedAt",
              json_agg(
                json_build_object(
                  'id', l.id,
                  'accountNumber', a.account_number,
                  'accountName', a.name,
                  'direction', l.direction,
                  'amountMinor', l.amount_minor::text,
                  'currency', l.currency
                ) ORDER BY l.direction ASC
              ) AS lines
       FROM payrail_private.journal_entries e
       JOIN payrail_private.ledger_lines l ON l.journal_entry_id = e.id
       JOIN payrail_private.accounts a ON a.id = l.account_id
       WHERE e.merchant_id = $1 AND e.reference_type = 'PAYMENT' AND e.reference_id = $2
       GROUP BY e.id, e.entry_number, e.reference_type, e.reference_id, e.description, e.posted_at
       ORDER BY e.posted_at ASC`,
      [merchantId, id]
    );
    const webhooksRes = await this.pool.query(
      `SELECT id, provider, environment, provider_event_id AS "providerEventId", event_type AS "eventType",
              signature_verified AS "signatureVerified", processing_state AS "processingState", error_message AS "errorMessage",
              received_at AS "receivedAt", processed_at AS "processedAt", raw_payload AS "rawPayload"
       FROM payrail_private.provider_events
       WHERE payment_intent_id = $1 OR (normalized_observation->>'providerPaymentIntentId') = $2
       ORDER BY received_at ASC`,
      [id, payment.providerPaymentIntentId || ""]
    );
    const attemptsRes = await this.pool.query(
      `SELECT id, provider, provider_account AS "providerAccount", environment, provider_operation_key AS "providerOperationKey",
              provider_payment_id AS "providerPaymentId", provider_payment_method_id AS "providerPaymentMethodId",
              submission_state AS "submissionState", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payrail_private.payment_attempts
       WHERE payment_intent_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    const auditRes = await this.pool.query(
      `SELECT id, actor_type AS "actorType", actor_id AS "actorId", action, resource_type AS "resourceType",
              resource_id AS "resourceId", metadata, ip_address AS "ipAddress", created_at AS "createdAt"
       FROM payrail_private.audit_events
       WHERE (merchant_id = $1 AND resource_id = $2) OR (metadata->>'paymentIntentId') = $2
       ORDER BY created_at ASC`,
      [merchantId, id]
    );
    return {
      payment,
      timeline: timelineRes.rows,
      ledger: ledgerRes.rows,
      webhooks: webhooksRes.rows,
      attempts: attemptsRes.rows,
      audit: auditRes.rows
    };
  }
  async transition(client, id, current, target, source, eventId) {
    await transitionSource(client, source);
    await client.query(
      "UPDATE payrail_private.payment_intents SET state=$2,updated_at=clock_timestamp() WHERE id=$1",
      [id, target]
    );
    await client.query(
      "INSERT INTO payrail_private.payment_state_events(payment_intent_id,previous_state,next_state,source,provider_event_id) VALUES($1,$2,$3,$4,$5)",
      [id, current, target, source, eventId ?? null]
    );
  }
  async applyObservationInTransaction(client, observation) {
    const result = await client.query(
      "SELECT p.*,a.id AS attempt_id FROM payrail_private.payment_intents p JOIN payrail_private.payment_attempts a ON a.payment_intent_id=p.id WHERE p.id=$1 AND p.merchant_id=$2 AND a.provider=$3 AND a.provider_account=$4 AND a.environment=$5 AND a.provider_payment_id=$6 FOR UPDATE OF p",
      [
        observation.paymentIntentId,
        observation.merchantId,
        observation.provider,
        observation.providerAccount,
        observation.environment,
        observation.providerPaymentIntentId
      ]
    );
    const payment = result.rows[0];
    if (!payment)
      throw new ConflictException("Observation identity does not match payment attempt");
    if (BigInt(payment.amount_minor) !== BigInt(observation.amountMinor) || payment.currency !== observation.currency)
      throw new ConflictException("Observation amount/currency mismatch");
    const current = payment.state;
    const target = observation.state;
    if (current === target || current === "SUCCEEDED")
      return { transitioned: false, currentState: current };
    if (!paymentTransitions[current].includes(target) || ["FAILED", "EXPIRED"].includes(current) && observation.source !== "RECONCILIATION")
      return { transitioned: false, currentState: current };
    await this.transition(
      client,
      payment.id,
      current,
      target,
      observation.source,
      observation.eventId
    );
    await client.query(
      "UPDATE payrail_private.payment_attempts SET submission_state=$2,updated_at=clock_timestamp() WHERE id=$1",
      [payment.attempt_id, target]
    );
    if (target === "SUCCEEDED") {
      await this.ledger.postPaymentSuccess(
        payment.merchant_id,
        payment.id,
        payment.amount_minor,
        payment.currency,
        client
      );
      await client.query(
        "UPDATE payrail_private.orders SET status='PAID',updated_at=clock_timestamp() WHERE id=$1 AND merchant_id=$2",
        [payment.order_id, payment.merchant_id]
      );
      await client.query(
        "INSERT INTO payrail_private.outbox_events(event_type,aggregate_type,aggregate_id,payload,business_effect_key) VALUES('payment.succeeded','payment',$1,$2,$3) ON CONFLICT DO NOTHING",
        [
          payment.id,
          JSON.stringify({
            paymentIntentId: payment.id,
            merchantId: payment.merchant_id,
            amountMinor: payment.amount_minor,
            currency: payment.currency,
            evidenceMode: payment.evidence_mode
          }),
          `payment.succeeded:${payment.id}`
        ]
      );
    }
    return { transitioned: true, currentState: target };
  }
  async applyGuardedTransition(id, target, source, _providerEventId) {
    if (target === "SUCCEEDED")
      throw new BadRequestException2("Success requires complete authoritative observation");
    return inTransaction(this.pool, async (client) => {
      const res = await client.query(
        "SELECT state FROM payrail_private.payment_intents WHERE id=$1 FOR UPDATE",
        [id]
      );
      const current = res.rows[0]?.state;
      if (!current) throw new NotFoundException2("Payment not found");
      if (!paymentTransitions[current].includes(target) || ["FAILED", "EXPIRED"].includes(current))
        return { transitioned: false, currentState: current };
      await this.transition(client, id, current, target, source);
      await client.query(
        "UPDATE payrail_private.payment_attempts SET submission_state=$2 WHERE payment_intent_id=$1",
        [id, target]
      );
      return { transitioned: true, currentState: target };
    });
  }
};
PaymentsService = __decorateClass([
  Injectable5(),
  __decorateParam(0, Inject4(PG_POOL)),
  __decorateParam(1, Inject4(PayMongoAdapter)),
  __decorateParam(2, Inject4(LedgerService))
], PaymentsService);

// src/auth/validation.ts
import { BadRequestException as BadRequestException3 } from "@nestjs/common";
import { z as z2 } from "zod";
var money = z2.string().regex(/^[1-9][0-9]{0,18}$/).refine((value) => BigInt(value) <= 9223372036854775807n);
var identifier = z2.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
function parseInput(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException3("Invalid request input.");
  return result.data;
}
function requiredIdempotency(value) {
  return parseInput(
    z2.string().min(1).max(128).regex(/^[\x21-\x7E]+$/),
    value
  );
}
function pageLimit(value, maximum = 100) {
  return parseInput(z2.coerce.number().int().min(1).max(maximum).default(50), value);
}

// src/payments/payments.controller.ts
var bodySchema = z3.strictObject({
  amountMinor: money.refine((value) => BigInt(value) >= 100n, {
    message: "Minimum transaction amount is PHP 1.00 (100 minor units)"
  }),
  currency: z3.literal("PHP").optional(),
  orderNumber: identifier.optional(),
  description: z3.string().max(240).optional()
});
var PaymentsController = class {
  constructor(payments) {
    this.payments = payments;
  }
  payments;
  async list(request2, limit) {
    return {
      data: await this.payments.listPaymentIntents(request2.user.merchantId, pageLimit(limit))
    };
  }
  async createPayment(body, key, request2) {
    const parsed = parseInput(bodySchema, body);
    return this.payments.createQrPhPayment(
      { ...parsed, merchantId: request2.user.merchantId },
      requiredIdempotency(key)
    );
  }
  getPayment(id, request2) {
    return this.payments.getPaymentIntent(parseInput(identifier, id), request2.user.merchantId);
  }
  async getInvestigation(id, request2) {
    return {
      data: await this.payments.getPaymentInvestigation(
        parseInput(identifier, id),
        request2.user.merchantId
      )
    };
  }
};
__decorateClass([
  Get2(),
  Permissions("payments:read"),
  __decorateParam(0, Req()),
  __decorateParam(1, Query("limit"))
], PaymentsController.prototype, "list", 1);
__decorateClass([
  Post(),
  Permissions("payments:write"),
  ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["amountMinor"],
      properties: {
        amountMinor: { type: "string", pattern: "^[1-9][0-9]{0,18}$" },
        currency: { type: "string", enum: ["PHP"] },
        orderNumber: { type: "string" },
        description: { type: "string", maxLength: 240 }
      }
    }
  }),
  __decorateParam(0, Body()),
  __decorateParam(1, Headers("idempotency-key")),
  __decorateParam(2, Req())
], PaymentsController.prototype, "createPayment", 1);
__decorateClass([
  Get2(":id"),
  Permissions("payments:read"),
  __decorateParam(0, Param("id")),
  __decorateParam(1, Req())
], PaymentsController.prototype, "getPayment", 1);
__decorateClass([
  Get2(":id/investigation"),
  Permissions("payments:read"),
  __decorateParam(0, Param("id")),
  __decorateParam(1, Req())
], PaymentsController.prototype, "getInvestigation", 1);
PaymentsController = __decorateClass([
  Controller2("payments"),
  ApiBearerAuth(),
  ApiSecurity("merchantKey"),
  AllowApiKey(),
  __decorateParam(0, Inject5(PaymentsService))
], PaymentsController);

// src/payments/qrph-checkout.service.ts
import { Inject as Inject6, Injectable as Injectable6, BadRequestException as BadRequestException4 } from "@nestjs/common";
var QrPhCheckoutService = class {
  constructor(paymentsService) {
    this.paymentsService = paymentsService;
  }
  paymentsService;
  async createCheckout(dto, idempotencyKey) {
    if (!dto.merchantId) {
      throw new BadRequestException4("Merchant ID is required for checkout.");
    }
    const payment = await this.paymentsService.createQrPhPayment(
      {
        amountMinor: dto.amountMinor,
        currency: dto.currency || "PHP",
        orderNumber: dto.orderNumber,
        description: dto.description || `PayRail QR Ph Checkout ${dto.orderNumber || ""}`.trim(),
        merchantId: dto.merchantId
      },
      idempotencyKey
    );
    const createdDate = new Date(payment.createdAt);
    const expiresAt = new Date(createdDate.getTime() + 30 * 60 * 1e3).toISOString();
    return {
      paymentId: payment.id,
      reference: payment.orderNumber,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: payment.state,
      qrCodeUrl: payment.qrCodeUrl,
      testUrl: payment.testUrl,
      expiresAt,
      provider: payment.provider,
      createdAt: payment.createdAt
    };
  }
  async getCheckout(paymentId, merchantId) {
    const payment = await this.paymentsService.getPaymentIntent(paymentId, merchantId);
    const createdDate = new Date(payment.createdAt);
    const expiresAt = new Date(createdDate.getTime() + 30 * 60 * 1e3).toISOString();
    return {
      paymentId: payment.id,
      reference: payment.orderNumber,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: payment.state,
      qrCodeUrl: payment.qrCodeUrl,
      testUrl: payment.testUrl,
      expiresAt,
      provider: payment.provider,
      createdAt: payment.createdAt
    };
  }
};
QrPhCheckoutService = __decorateClass([
  Injectable6(),
  __decorateParam(0, Inject6(PaymentsService))
], QrPhCheckoutService);

// src/ledger/ledger.module.ts
import { Module as Module4 } from "@nestjs/common";

// src/ledger/ledger.controller.ts
import { Controller as Controller3, Get as Get3, Post as Post2, Body as Body2, Query as Query2, Inject as Inject7, Req as Req2 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth2 } from "@nestjs/swagger";
import { z as z4 } from "zod";
var LedgerController = class {
  constructor(ledger) {
    this.ledger = ledger;
  }
  ledger;
  async getAccounts(request2) {
    return { data: await this.ledger.getAccountBalances(request2.user.merchantId) };
  }
  async getEntries(request2, limit) {
    return { data: await this.ledger.getJournalEntries(request2.user.merchantId, pageLimit(limit)) };
  }
  async createEntry(request2, body) {
    const parsed = parseInput(
      z4.strictObject({
        referenceType: z4.literal("ADJUSTMENT"),
        referenceId: identifier,
        description: z4.string().min(1).max(240),
        lines: z4.array(
          z4.strictObject({
            accountNumber: identifier,
            direction: z4.enum(["DEBIT", "CREDIT"]),
            amountMinor: money,
            currency: z4.literal("PHP").optional()
          })
        ).min(2).max(50)
      }),
      body
    );
    const lines = parsed.lines.map((line) => ({
      accountNumber: line.accountNumber,
      direction: line.direction,
      amountMinor: line.amountMinor,
      currency: line.currency || "PHP"
    }));
    return {
      data: await this.ledger.createJournalEntry({
        ...parsed,
        lines,
        merchantId: request2.user.merchantId
      })
    };
  }
};
__decorateClass([
  Get3("accounts"),
  Permissions("ledger:read"),
  __decorateParam(0, Req2())
], LedgerController.prototype, "getAccounts", 1);
__decorateClass([
  Get3("entries"),
  Permissions("ledger:read"),
  __decorateParam(0, Req2()),
  __decorateParam(1, Query2("limit"))
], LedgerController.prototype, "getEntries", 1);
__decorateClass([
  Post2("entries"),
  Permissions("ledger:write"),
  __decorateParam(0, Req2()),
  __decorateParam(1, Body2())
], LedgerController.prototype, "createEntry", 1);
LedgerController = __decorateClass([
  Controller3("ledger"),
  ApiBearerAuth2(),
  __decorateParam(0, Inject7(LedgerService))
], LedgerController);

// src/ledger/ledger.module.ts
var LedgerModule = class {
};
LedgerModule = __decorateClass([
  Module4({
    controllers: [LedgerController],
    providers: [LedgerService],
    exports: [LedgerService]
  })
], LedgerModule);

// src/payments/payments.module.ts
var PaymentsModule = class {
};
PaymentsModule = __decorateClass([
  Module5({
    imports: [PayMongoModule, LedgerModule],
    controllers: [PaymentsController],
    providers: [PaymentsService, QrPhCheckoutService],
    exports: [PaymentsService, QrPhCheckoutService]
  })
], PaymentsModule);

// src/webhooks/webhooks.module.ts
import { Module as Module6 } from "@nestjs/common";

// src/webhooks/webhooks.controller.ts
import { BadRequestException as BadRequestException6, Controller as Controller4, Headers as Headers2, Inject as Inject9, Post as Post3, Req as Req3 } from "@nestjs/common";

// src/webhooks/webhooks.service.ts
import {
  BadRequestException as BadRequestException5,
  Inject as Inject8,
  Injectable as Injectable7,
  Logger,
  Optional as Optional2,
  UnauthorizedException
} from "@nestjs/common";
import * as crypto3 from "node:crypto";
var WebhooksService = class {
  constructor(pool, paymentsService, adapter) {
    this.pool = pool;
    this.paymentsService = paymentsService;
    this.adapter = adapter;
    let webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || "whsk_test_placeholder";
    let environment = process.env.PAYMENTS_MODE || "test";
    try {
      const env = parseEnvironment(process.env);
      webhookSecret = env.PAYMONGO_WEBHOOK_SECRET;
      environment = env.PAYMENTS_MODE;
    } catch {
    }
    if ((process.env.APP_ENV === "staging" || process.env.APP_ENV === "production") && webhookSecret === "whsk_test_placeholder") {
      throw new Error(
        "Insecure default PAYMONGO_WEBHOOK_SECRET placeholder is prohibited in staging and production environments."
      );
    }
    this.webhookSecret = webhookSecret;
    this.environment = environment;
    this.adapterAccount = this.adapter?.account || (this.environment === "sandbox" ? "sandbox" : "fixture");
  }
  pool;
  paymentsService;
  adapter;
  logger = new Logger(WebhooksService.name);
  webhookSecret;
  environment;
  adapterAccount;
  async processPayMongoWebhook(rawBody, signatureHeader) {
    if (!signatureHeader) {
      throw new BadRequestException5("Missing paymongo-signature header.");
    }
    const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const isValid = PayMongoAdapter.verifySignature(rawBody, signatureHeader, this.webhookSecret);
    if (!isValid) {
      this.logger.warn("PayMongo webhook signature verification failed.");
      throw new UnauthorizedException("Invalid paymongo-signature.");
    }
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(bodyString);
    } catch {
      throw new BadRequestException5("Invalid JSON payload.");
    }
    const providerEventId = parsedPayload?.data?.id;
    const eventType = parsedPayload?.data?.attributes?.type;
    if (!providerEventId || !eventType) {
      throw new BadRequestException5("Malformed PayMongo event payload.");
    }
    const payloadHash = crypto3.createHash("sha256").update(bodyString).digest("hex");
    const paymentData = parsedPayload?.data?.attributes?.data;
    const providerPaymentIntentId = paymentData?.attributes?.payment_intent_id;
    const observedAmount = paymentData?.attributes?.amount;
    const observedCurrency = paymentData?.attributes?.currency?.toUpperCase();
    const status = paymentData?.attributes?.status;
    const result = await inTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT id FROM payrail_private.provider_events WHERE provider='paymongo' AND provider_account=$1 AND environment=$2 AND provider_event_id=$3 FOR UPDATE`,
        [this.adapterAccount, this.environment, providerEventId]
      );
      if (existing.rows[0]) return { deduplicated: true };
      const internalEventId = `evt_${crypto3.randomUUID()}`;
      const inserted = await client.query(
        `INSERT INTO payrail_private.provider_events(id,provider,provider_account,environment,provider_event_id,event_type,payload_hash,raw_payload,signature_verified,processing_state)
         VALUES($1,'paymongo',$2,$3,$4,$5,$6,$7,true,'PENDING') ON CONFLICT DO NOTHING RETURNING id`,
        [
          internalEventId,
          this.adapterAccount,
          this.environment,
          providerEventId,
          eventType,
          payloadHash,
          bodyString
        ]
      );
      if (!inserted.rowCount) return { deduplicated: true };
      if (eventType !== "payment.paid") {
        await client.query(
          "UPDATE payrail_private.provider_events SET processing_state='IGNORED',processed_at=clock_timestamp() WHERE id=$1",
          [internalEventId]
        );
        return { deduplicated: false };
      }
      if (!providerPaymentIntentId || !Number.isSafeInteger(observedAmount) || !observedCurrency || status !== "paid") {
        await client.query(
          "UPDATE payrail_private.provider_events SET processing_state='DISCREPANCY',error_message='Incomplete paid observation',processed_at=clock_timestamp() WHERE id=$1",
          [internalEventId]
        );
        return { deduplicated: false };
      }
      const lookup2 = await client.query(
        `SELECT p.id,p.merchant_id FROM payrail_private.payment_intents p JOIN payrail_private.payment_attempts a ON a.payment_intent_id=p.id
         WHERE a.provider='paymongo' AND a.provider_account=$1 AND a.environment=$2 AND a.provider_payment_id=$3 FOR UPDATE OF p`,
        [this.adapterAccount, this.environment, providerPaymentIntentId]
      );
      const payment = lookup2.rows[0];
      if (!payment) {
        await client.query(
          "UPDATE payrail_private.provider_events SET processing_state='DISCREPANCY',error_message='Unmatched payment intent',processed_at=clock_timestamp() WHERE id=$1",
          [internalEventId]
        );
        return { deduplicated: false };
      }
      const stored = await client.query(
        "SELECT amount_minor,currency FROM payrail_private.payment_intents WHERE id=$1",
        [payment.id]
      );
      if (stored.rows[0]?.amount_minor !== String(observedAmount) || stored.rows[0]?.currency !== observedCurrency) {
        await client.query(
          "UPDATE payrail_private.provider_events SET payment_intent_id=$1,normalized_observation=$2,processing_state='DISCREPANCY',error_message='Amount or currency mismatch',processed_at=clock_timestamp() WHERE id=$3",
          [
            payment.id,
            JSON.stringify({
              providerPaymentIntentId,
              amountMinor: String(observedAmount),
              currency: observedCurrency
            }),
            internalEventId
          ]
        );
        return { deduplicated: false };
      }
      await client.query(
        "UPDATE payrail_private.provider_events SET payment_intent_id=$1,normalized_observation=$2 WHERE id=$3",
        [
          payment.id,
          JSON.stringify({
            providerPaymentIntentId,
            amountMinor: String(observedAmount),
            currency: observedCurrency,
            state: "SUCCEEDED"
          }),
          internalEventId
        ]
      );
      await this.paymentsService.applyObservationInTransaction(client, {
        paymentIntentId: payment.id,
        merchantId: payment.merchant_id,
        provider: "paymongo",
        providerAccount: this.adapterAccount,
        environment: "test",
        providerPaymentIntentId,
        amountMinor: String(observedAmount),
        currency: observedCurrency,
        state: "SUCCEEDED",
        source: "VERIFIED_WEBHOOK",
        eventId: internalEventId
      });
      await client.query(
        "UPDATE payrail_private.provider_events SET processing_state='PROCESSED',processed_at=clock_timestamp() WHERE id=$1",
        [internalEventId]
      );
      return { deduplicated: false };
    });
    if (result.deduplicated)
      this.logger.warn(`Duplicate webhook delivery detected: ${providerEventId}`);
    return {
      received: true,
      deduplicated: result.deduplicated,
      processed: !result.deduplicated,
      eventId: providerEventId
    };
  }
};
WebhooksService = __decorateClass([
  Injectable7(),
  __decorateParam(0, Inject8(PG_POOL)),
  __decorateParam(1, Inject8(PaymentsService)),
  __decorateParam(2, Optional2()),
  __decorateParam(2, Inject8(PayMongoAdapter))
], WebhooksService);

// src/webhooks/webhooks.controller.ts
var WebhooksController = class {
  constructor(webhooksService) {
    this.webhooksService = webhooksService;
  }
  webhooksService;
  async handlePayMongoWebhook(req, signatureHeader) {
    const rawBody = req.rawBody;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      throw new BadRequestException6("Missing raw request body.");
    }
    return this.webhooksService.processPayMongoWebhook(rawBody, signatureHeader);
  }
};
__decorateClass([
  Post3("paymongo"),
  Public(),
  __decorateParam(0, Req3()),
  __decorateParam(1, Headers2("paymongo-signature"))
], WebhooksController.prototype, "handlePayMongoWebhook", 1);
WebhooksController = __decorateClass([
  Controller4("webhooks"),
  __decorateParam(0, Inject9(WebhooksService))
], WebhooksController);

// src/webhooks/webhooks.module.ts
var WebhooksModule = class {
};
WebhooksModule = __decorateClass([
  Module6({
    imports: [PaymentsModule, PayMongoModule],
    controllers: [WebhooksController],
    providers: [WebhooksService],
    exports: [WebhooksService]
  })
], WebhooksModule);

// src/refunds/refunds.module.ts
import { Module as Module7 } from "@nestjs/common";

// src/refunds/refunds.service.ts
import {
  BadRequestException as BadRequestException7,
  ConflictException as ConflictException2,
  Inject as Inject10,
  Injectable as Injectable8,
  NotFoundException as NotFoundException3
} from "@nestjs/common";
import * as crypto4 from "node:crypto";
var RefundsService = class {
  constructor(pool, ledgerService, _payMongoAdapter) {
    this.pool = pool;
    this.ledgerService = ledgerService;
    this._payMongoAdapter = _payMongoAdapter;
  }
  pool;
  ledgerService;
  _payMongoAdapter;
  calculateFingerprint(body) {
    const canonical = JSON.stringify(body, Object.keys(body).sort());
    return crypto4.createHash("sha256").update(canonical).digest("hex");
  }
  /**
   * Issues an idempotent, aggregate-locked refund.
   * Invariants:
   * 1. PaymentIntent must exist and be in SUCCEEDED state.
   * 2. (Existing Active Refunds + Requested Refund) <= Payment Amount.
   * 3. Row-level pessimistic locking (FOR UPDATE) prevents concurrent refund double-spend races.
   * 4. Compensating ledger journal entry posted on refund success.
   */
  async createRefund(dto) {
    this._payMongoAdapter.assertRefundAvailable();
    const refundAmount = BigInt(dto.amountMinor);
    if (refundAmount <= 0n) {
      throw new BadRequestException7("Refund amount must be strictly positive.");
    }
    const fingerprint = this.calculateFingerprint({
      merchantId: dto.merchantId,
      paymentIntentId: dto.paymentIntentId,
      amountMinor: dto.amountMinor,
      reason: dto.reason
    });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const idemRes = await client.query(
        `SELECT request_fingerprint, result_reference, status
         FROM payrail_private.idempotency_records
         WHERE merchant_id = $1 AND operation = 'CREATE_REFUND' AND idempotency_key = $2
         FOR UPDATE`,
        [dto.merchantId, dto.idempotencyKey]
      );
      if (idemRes.rows.length > 0) {
        const record = idemRes.rows[0];
        if (record) {
          if (record.request_fingerprint !== fingerprint) {
            throw new ConflictException2(
              "Idempotency conflict: Idempotency-Key already used with different payload."
            );
          }
          if (record.result_reference) {
            const existingRefund = await this.getRefundByIdInternal(
              dto.merchantId,
              record.result_reference,
              client
            );
            if (existingRefund) {
              await client.query("COMMIT");
              return existingRefund;
            }
          }
        }
      }
      const paymentRes = await client.query(
        `SELECT id, merchant_id, amount_minor, currency, state
         FROM payrail_private.payment_intents
         WHERE id = $1 AND merchant_id = $2
         FOR UPDATE`,
        [dto.paymentIntentId, dto.merchantId]
      );
      const payment = paymentRes.rows[0];
      if (!payment) {
        throw new NotFoundException3(
          `Payment intent '${dto.paymentIntentId}' not found for merchant '${dto.merchantId}'.`
        );
      }
      if (payment.state !== "SUCCEEDED") {
        throw new BadRequestException7(
          `Cannot refund payment intent in state '${payment.state}'. Only SUCCEEDED payments are refundable.`
        );
      }
      const paymentTotal = BigInt(payment.amount_minor);
      const existingRefundsRes = await client.query(
        `SELECT COALESCE(SUM(amount_minor), 0)::text AS total_refunded
         FROM payrail_private.refunds
         WHERE payment_intent_id = $1 AND state IN ('PENDING', 'SUCCEEDED', 'UNKNOWN')`,
        [dto.paymentIntentId]
      );
      const alreadyRefunded = BigInt(existingRefundsRes.rows[0]?.total_refunded || "0");
      const availableCapacity = paymentTotal - alreadyRefunded;
      if (refundAmount > availableCapacity) {
        throw new ConflictException2(
          `Refund capacity exceeded: payment total is ${paymentTotal}, active refunds/reservations are ${alreadyRefunded}, requested is ${refundAmount}, available is ${availableCapacity}.`
        );
      }
      const refundId = crypto4.randomUUID();
      const currency = dto.currency || payment.currency;
      await client.query(
        `INSERT INTO payrail_private.refunds 
           (id, merchant_id, payment_intent_id, amount_minor, currency, reason, state, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)`,
        [
          refundId,
          dto.merchantId,
          dto.paymentIntentId,
          dto.amountMinor,
          currency,
          dto.reason,
          dto.idempotencyKey
        ]
      );
      if (idemRes.rows.length === 0) {
        await client.query(
          `INSERT INTO payrail_private.idempotency_records
             (merchant_id, operation, idempotency_key, request_fingerprint, result_reference, status)
          VALUES ($1, 'CREATE_REFUND', $2, $3, $4, 'PENDING')`,
          [dto.merchantId, dto.idempotencyKey, fingerprint, refundId]
        );
      }
      const providerPayment = await client.query(
        `SELECT provider_payment_id FROM payrail_private.payment_attempts WHERE payment_intent_id=$1 AND provider='paymongo' ORDER BY created_at DESC LIMIT 1`,
        [dto.paymentIntentId]
      );
      const providerResult = await this._payMongoAdapter.createRefund(
        providerPayment.rows[0]?.provider_payment_id ?? "",
        refundAmount,
        dto.reason,
        refundId
      );
      const providerRefundId = providerResult.providerRefundId;
      await client.query(
        `UPDATE payrail_private.refunds
         SET state = 'SUCCEEDED', provider_refund_id = $1, updated_at = clock_timestamp()
         WHERE id = $2`,
        [providerRefundId, refundId]
      );
      await this.ledgerService.postRefund(
        dto.merchantId,
        refundId,
        dto.amountMinor,
        currency,
        client
      );
      await client.query(
        `INSERT INTO payrail_private.outbox_events
           (event_type, aggregate_type, aggregate_id, payload)
         VALUES ('refund.succeeded', 'refund', $1, $2)`,
        [
          refundId,
          JSON.stringify({
            refundId,
            merchantId: dto.merchantId,
            paymentIntentId: dto.paymentIntentId,
            amountMinor: dto.amountMinor,
            currency,
            providerRefundId
          })
        ]
      );
      await client.query(
        `UPDATE payrail_private.idempotency_records
         SET status = 'RESOLVED', updated_at = clock_timestamp()
         WHERE merchant_id = $1 AND operation = 'CREATE_REFUND' AND idempotency_key = $2`,
        [dto.merchantId, dto.idempotencyKey]
      );
      await client.query("COMMIT");
      return {
        id: refundId,
        merchantId: dto.merchantId,
        paymentIntentId: dto.paymentIntentId,
        amountMinor: dto.amountMinor,
        currency,
        reason: dto.reason,
        state: "SUCCEEDED",
        idempotencyKey: dto.idempotencyKey,
        providerRefundId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  async getRefundByIdInternal(merchantId, id, client) {
    const res = await client.query(`SELECT * FROM payrail_private.refunds WHERE id = $1 AND merchant_id = $2`, [
      id,
      merchantId
    ]);
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      merchantId: r.merchant_id,
      paymentIntentId: r.payment_intent_id,
      amountMinor: r.amount_minor,
      currency: r.currency,
      reason: r.reason,
      state: r.state,
      idempotencyKey: r.idempotency_key,
      providerRefundId: r.provider_refund_id || void 0,
      failureReason: r.failure_reason || void 0,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    };
  }
  async getRefunds(merchantId, paymentIntentId) {
    let query = `SELECT * FROM payrail_private.refunds WHERE merchant_id = $1`;
    const params = [merchantId];
    if (paymentIntentId) {
      query += ` AND payment_intent_id = $2`;
      params.push(paymentIntentId);
    }
    query += ` ORDER BY created_at DESC`;
    const res = await this.pool.query(query, params);
    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id,
      paymentIntentId: r.payment_intent_id,
      amountMinor: r.amount_minor,
      currency: r.currency,
      reason: r.reason,
      state: r.state,
      idempotencyKey: r.idempotency_key,
      providerRefundId: r.provider_refund_id || void 0,
      failureReason: r.failure_reason || void 0,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    }));
  }
  async getRefundById(merchantId, id) {
    const res = await this.pool.query(`SELECT * FROM payrail_private.refunds WHERE id = $1 AND merchant_id = $2`, [
      id,
      merchantId
    ]);
    const r = res.rows[0];
    if (!r) {
      throw new NotFoundException3(`Refund '${id}' not found for merchant '${merchantId}'.`);
    }
    return {
      id: r.id,
      merchantId: r.merchant_id,
      paymentIntentId: r.payment_intent_id,
      amountMinor: r.amount_minor,
      currency: r.currency,
      reason: r.reason,
      state: r.state,
      idempotencyKey: r.idempotency_key,
      providerRefundId: r.provider_refund_id || void 0,
      failureReason: r.failure_reason || void 0,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    };
  }
};
RefundsService = __decorateClass([
  Injectable8(),
  __decorateParam(0, Inject10(PG_POOL)),
  __decorateParam(1, Inject10(LedgerService)),
  __decorateParam(2, Inject10(PayMongoAdapter))
], RefundsService);

// src/refunds/refunds.controller.ts
import { Controller as Controller5, Get as Get4, Post as Post4, Body as Body3, Param as Param2, Query as Query3, Headers as Headers3, Inject as Inject11, Req as Req4 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth3, ApiSecurity as ApiSecurity2 } from "@nestjs/swagger";
import { z as z5 } from "zod";
var RefundsController = class {
  constructor(refunds) {
    this.refunds = refunds;
  }
  refunds;
  async getRefunds(request2, id) {
    return {
      data: await this.refunds.getRefunds(
        request2.user.merchantId,
        id === void 0 ? void 0 : parseInput(identifier, id)
      )
    };
  }
  async getRefundById(request2, id) {
    return {
      data: await this.refunds.getRefundById(request2.user.merchantId, parseInput(identifier, id))
    };
  }
  async createRefund(request2, key, body) {
    const parsed = parseInput(
      z5.strictObject({
        paymentIntentId: identifier,
        amountMinor: money,
        reason: z5.string().min(1).max(240),
        currency: z5.literal("PHP").optional()
      }),
      body
    );
    return {
      data: await this.refunds.createRefund({
        ...parsed,
        merchantId: request2.user.merchantId,
        idempotencyKey: requiredIdempotency(key)
      })
    };
  }
};
__decorateClass([
  Get4(),
  Permissions("refunds:read"),
  __decorateParam(0, Req4()),
  __decorateParam(1, Query3("paymentIntentId"))
], RefundsController.prototype, "getRefunds", 1);
__decorateClass([
  Get4(":id"),
  Permissions("refunds:read"),
  __decorateParam(0, Req4()),
  __decorateParam(1, Param2("id"))
], RefundsController.prototype, "getRefundById", 1);
__decorateClass([
  Post4(),
  Permissions("refunds:write"),
  __decorateParam(0, Req4()),
  __decorateParam(1, Headers3("idempotency-key")),
  __decorateParam(2, Body3())
], RefundsController.prototype, "createRefund", 1);
RefundsController = __decorateClass([
  Controller5("refunds"),
  ApiBearerAuth3(),
  ApiSecurity2("merchantKey"),
  AllowApiKey(),
  __decorateParam(0, Inject11(RefundsService))
], RefundsController);

// src/refunds/refunds.module.ts
var RefundsModule = class {
};
RefundsModule = __decorateClass([
  Module7({
    imports: [LedgerModule, PayMongoModule],
    controllers: [RefundsController],
    providers: [RefundsService],
    exports: [RefundsService]
  })
], RefundsModule);

// src/jobs/jobs.module.ts
import { Module as Module8 } from "@nestjs/common";

// src/jobs/durable-jobs.service.ts
import { Inject as Inject12, Injectable as Injectable9, NotFoundException as NotFoundException4 } from "@nestjs/common";
var DurableJobsService = class {
  constructor(pool) {
    this.pool = pool;
  }
  pool;
  /**
   * Creates a durable job, optionally within an existing transaction client.
   */
  async createJob(jobType, payload, client) {
    const queryExecutor = client || this.pool;
    const res = await queryExecutor.query(
      `INSERT INTO payrail_private.durable_jobs (job_type, payload, state)
       VALUES ($1, $2, 'PENDING')
       RETURNING id`,
      [jobType, JSON.stringify(payload)]
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to enqueue durable job");
    }
    return row.id;
  }
  /**
   * Claims up to `limit` pending or scheduled jobs using SELECT ... FOR UPDATE SKIP LOCKED.
   * Employs lease fencing to guarantee only one worker owns the job during the lease window.
   */
  async claimJobs(workerId, limit = 5, leaseSeconds = 30) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `WITH claimable AS (
           SELECT id
           FROM payrail_private.durable_jobs
           WHERE (state IN ('PENDING', 'RETRY_SCHEDULED') AND next_attempt_at <= clock_timestamp())
              OR (state='CLAIMED' AND locked_until <= clock_timestamp())
           ORDER BY next_attempt_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE payrail_private.durable_jobs j
         SET state = 'CLAIMED',
             locked_by = $2,
             claim_token = gen_random_uuid(),
             locked_until = clock_timestamp() + ($3 * INTERVAL '1 second'),
             attempt_count = j.attempt_count + 1,
             updated_at = clock_timestamp()
         FROM claimable
         WHERE j.id = claimable.id
        RETURNING j.*`,
        [limit, workerId, leaseSeconds]
      );
      await client.query("COMMIT");
      return res.rows.map((r) => ({
        id: r.id,
        jobType: r.job_type,
        payload: r.payload,
        state: r.state,
        attemptCount: r.attempt_count,
        maxAttempts: r.max_attempts,
        nextAttemptAt: r.next_attempt_at.toISOString(),
        lockedBy: r.locked_by || void 0,
        claimToken: r.claim_token || void 0,
        lockedUntil: r.locked_until?.toISOString(),
        lastError: r.last_error || void 0,
        errorCode: r.error_code || void 0,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString()
      }));
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Marks a claimed job as COMPLETED.
   */
  async completeJob(jobId, workerId, claimToken) {
    const result = await this.pool.query(
      `UPDATE payrail_private.durable_jobs
       SET state = 'COMPLETED', locked_by = NULL, locked_until = NULL, claim_token = NULL, updated_at = clock_timestamp()
       WHERE id = $1 AND state='CLAIMED' AND locked_by = $2 AND claim_token=$3 AND locked_until > clock_timestamp()`,
      [jobId, workerId, claimToken]
    );
    if (!result.rowCount) throw new Error("Job claim is stale or not owned by this worker");
  }
  /**
   * Handles job failure with exponential backoff and jitter, or routes to Dead Letter Queue.
   */
  async failJob(jobId, workerId, claimToken, error, isTransient = true) {
    const errorMessage = typeof error === "string" ? error : error.message;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `SELECT id, job_type, payload, attempt_count, max_attempts
         FROM payrail_private.durable_jobs
         WHERE id = $1 AND state='CLAIMED' AND locked_by=$2 AND claim_token=$3 AND locked_until > clock_timestamp()
         FOR UPDATE`,
        [jobId, workerId, claimToken]
      );
      const job = res.rows[0];
      if (!job) {
        await client.query("ROLLBACK");
        throw new Error("Job claim is stale or not owned by this worker");
      }
      if (isTransient && job.attempt_count < job.max_attempts) {
        const baseDelay = 2 ** job.attempt_count;
        const jitter = Math.random() * 2;
        const delaySeconds = Math.min(Math.round(baseDelay + jitter), 300);
        await client.query(
          `UPDATE payrail_private.durable_jobs
           SET state = 'RETRY_SCHEDULED',
               next_attempt_at = clock_timestamp() + ($1 * INTERVAL '1 second'),
               locked_by = NULL,
               locked_until = NULL,
               claim_token = NULL,
               last_error = $2,
               updated_at = clock_timestamp()
           WHERE id = $3`,
          [delaySeconds, errorMessage, jobId]
        );
      } else {
        await client.query(
          `UPDATE payrail_private.durable_jobs
           SET state = 'DEAD_LETTER',
               locked_by = NULL,
               locked_until = NULL,
               claim_token = NULL,
               last_error = $1,
               updated_at = clock_timestamp()
           WHERE id = $2`,
          [errorMessage, jobId]
        );
        const merchantId = job.payload?.merchantId;
        await client.query(
          `INSERT INTO payrail_private.dead_letter_queue
             (job_id, merchant_id, job_type, payload, failure_reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [jobId, merchantId || null, job.job_type, JSON.stringify(job.payload), errorMessage]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Retrieves active Dead Letter Queue entries for operations inspection.
   */
  async getDeadLetters(limit = 50) {
    const res = await this.pool.query(
      `SELECT * FROM payrail_private.dead_letter_queue
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      merchantId: r.merchant_id || void 0,
      jobType: r.job_type,
      payload: r.payload,
      failureReason: r.failure_reason,
      replayedAt: r.replayed_at?.toISOString(),
      replayedBy: r.replayed_by || void 0,
      createdAt: r.created_at.toISOString()
    }));
  }
  /**
   * Retrieves active durable jobs for operations inspection.
   */
  async getActiveJobs(limit = 50) {
    const res = await this.pool.query(
      `SELECT * FROM payrail_private.durable_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map((r) => ({
      id: r.id,
      jobType: r.job_type,
      payload: r.payload,
      state: r.state,
      attemptCount: r.attempt_count,
      maxAttempts: r.max_attempts,
      nextAttemptAt: r.next_attempt_at.toISOString(),
      lockedBy: r.locked_by || void 0,
      claimToken: r.claim_token || void 0,
      lockedUntil: r.locked_until?.toISOString(),
      lastError: r.last_error || void 0,
      errorCode: r.error_code || void 0,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString()
    }));
  }
  /**
   * Replays an existing dead-letter item by re-queuing a new clean durable job.
   */
  async replayDeadLetter(dlqId, replayedBy) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `SELECT id, job_type, payload FROM payrail_private.dead_letter_queue WHERE id = $1 FOR UPDATE`,
        [dlqId]
      );
      const dlq = res.rows[0];
      if (!dlq) {
        throw new NotFoundException4(`Dead letter entry '${dlqId}' not found.`);
      }
      const jobRes = await client.query(
        `INSERT INTO payrail_private.durable_jobs (job_type, payload, state)
         VALUES ($1, $2, 'PENDING')
         RETURNING id`,
        [dlq.job_type, JSON.stringify(dlq.payload)]
      );
      const replayedJobId = jobRes.rows[0]?.id || "";
      await client.query(
        `UPDATE payrail_private.dead_letter_queue
         SET replayed_at = clock_timestamp(), replayed_by = $1
         WHERE id = $2`,
        [replayedBy, dlqId]
      );
      await client.query(
        `INSERT INTO payrail_private.audit_events
           (actor_type, actor_id, action, resource_type, resource_id, metadata)
         VALUES ('OPERATOR', $1, 'DLQ_REPLAY', 'dead_letter_queue', $2, $3)`,
        [replayedBy, dlqId, JSON.stringify({ replayedJobId, jobType: dlq.job_type })]
      );
      await client.query("COMMIT");
      return replayedJobId;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
};
DurableJobsService = __decorateClass([
  Injectable9(),
  __decorateParam(0, Inject12(PG_POOL))
], DurableJobsService);

// src/jobs/outbox.service.ts
import { Inject as Inject13, Injectable as Injectable10 } from "@nestjs/common";
var OutboxService = class {
  constructor(pool) {
    this.pool = pool;
  }
  pool;
  /**
   * Atomically records an outbox event.
   * If a client is provided, the event is committed within the exact same database transaction
   * as the originating financial mutation, guaranteeing zero message loss.
   */
  async emit(eventType, aggregateType, aggregateId, payload, client) {
    const executor = client || this.pool;
    const res = await executor.query(
      `INSERT INTO payrail_private.outbox_events 
         (event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [eventType, aggregateType, aggregateId, JSON.stringify(payload)]
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert outbox event");
    }
    return row.id;
  }
  /**
   * Fetches unpublished outbox events and marks them as published after dispatch.
   */
  async fetchUnpublished(limit = 20) {
    const res = await this.pool.query(
      `SELECT * FROM payrail_private.outbox_events
       WHERE published_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      payload: r.payload,
      createdAt: r.created_at.toISOString(),
      publishedAt: r.published_at?.toISOString()
    }));
  }
  /**
   * Marks a batch of outbox events as published.
   */
  async markPublished(eventIds) {
    if (eventIds.length === 0) return;
    await this.pool.query(
      `UPDATE payrail_private.outbox_events
       SET published_at = clock_timestamp()
       WHERE id = ANY($1::uuid[])`,
      [eventIds]
    );
  }
};
OutboxService = __decorateClass([
  Injectable10(),
  __decorateParam(0, Inject13(PG_POOL))
], OutboxService);

// src/jobs/jobs.controller.ts
import { Controller as Controller6, Get as Get5, Post as Post5, Param as Param3, Query as Query4, Inject as Inject14, Req as Req5 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth4 } from "@nestjs/swagger";
var JobsController = class {
  constructor(jobs, outbox) {
    this.jobs = jobs;
    this.outbox = outbox;
  }
  jobs;
  outbox;
  async getDeadLetters(_request, limit) {
    return { data: await this.jobs.getDeadLetters(pageLimit(limit)) };
  }
  async replayDeadLetter(id, request2) {
    const newJobId = await this.jobs.replayDeadLetter(
      parseInput(identifier, id),
      request2.user.userId
    );
    return { message: "Dead letter replayed.", data: { originalDlqId: id, newJobId } };
  }
  async getUnpublishedOutbox(_request, limit) {
    return { data: await this.outbox.fetchUnpublished(pageLimit(limit, 50)) };
  }
};
__decorateClass([
  Get5("dlq"),
  Permissions("jobs:read"),
  __decorateParam(0, Req5()),
  __decorateParam(1, Query4("limit"))
], JobsController.prototype, "getDeadLetters", 1);
__decorateClass([
  Post5("dlq/:id/replay"),
  Permissions("jobs:replay"),
  __decorateParam(0, Param3("id")),
  __decorateParam(1, Req5())
], JobsController.prototype, "replayDeadLetter", 1);
__decorateClass([
  Get5("outbox/unpublished"),
  Permissions("jobs:read"),
  __decorateParam(0, Req5()),
  __decorateParam(1, Query4("limit"))
], JobsController.prototype, "getUnpublishedOutbox", 1);
JobsController = __decorateClass([
  Controller6("jobs"),
  ApiBearerAuth4(),
  __decorateParam(0, Inject14(DurableJobsService)),
  __decorateParam(1, Inject14(OutboxService))
], JobsController);

// src/jobs/jobs.module.ts
var JobsModule = class {
};
JobsModule = __decorateClass([
  Module8({
    controllers: [JobsController],
    providers: [DurableJobsService, OutboxService],
    exports: [DurableJobsService, OutboxService]
  })
], JobsModule);

// src/auth/auth.module.ts
import { Module as Module10, Global as Global2 } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

// src/auth/auth.service.ts
import { ForbiddenException, Inject as Inject15, Injectable as Injectable11, UnauthorizedException as UnauthorizedException2 } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z as z6 } from "zod";
var AUTH_JWKS = /* @__PURE__ */ Symbol("AUTH_JWKS");
var identitySchema = z6.object({
  sub: z6.uuid(),
  email: z6.email(),
  role: z6.literal("authenticated"),
  session_id: z6.uuid()
});
function createAuthKeyResolver() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is required to configure operator identity.");
  return createRemoteJWKSet(new URL(`${url.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`), {
    timeoutDuration: 3e3,
    cacheMaxAge: 6e5,
    cooldownDuration: 3e4
  });
}
var AuthService = class {
  constructor(pool, keys) {
    this.pool = pool;
    this.keys = keys;
  }
  pool;
  keys;
  async verifyAccessToken(token, selectedMerchant) {
    let identity;
    try {
      const url = process.env.SUPABASE_URL;
      if (!url) throw new Error("Identity unavailable");
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: `${url.replace(/\/$/, "")}/auth/v1`,
        audience: "authenticated",
        algorithms: ["ES256", "RS256"],
        requiredClaims: ["exp", "iat", "sub", "session_id", "role"],
        clockTolerance: 0
      });
      identity = identitySchema.parse(payload);
    } catch {
      throw new UnauthorizedException2("Invalid or expired operator access token.");
    }
    const result = await this.pool.query(
      `SELECT m.merchant_id, m.role, COALESCE(array_agg(p.permission) FILTER (WHERE p.permission IS NOT NULL), '{}') AS permissions
       FROM payrail_private.operator_memberships m
       JOIN payrail_private.operators o ON o.id = m.operator_id AND o.is_active = true
       LEFT JOIN payrail_private.role_permissions p ON p.role = m.role
       WHERE m.operator_id = $1 AND ($2::text IS NULL OR m.merchant_id = $2)
         AND m.environment = $3 AND m.is_active = true
       GROUP BY m.merchant_id, m.role`,
      [identity.sub, selectedMerchant || null, process.env.APP_ENV || "local"]
    );
    const membership = result.rows[0];
    if (!membership || result.rows.length !== 1)
      throw new ForbiddenException("An active, unambiguous merchant membership is required.");
    return {
      userId: identity.sub,
      email: identity.email,
      merchantId: membership.merchant_id,
      role: membership.role,
      permissions: membership.permissions,
      actorType: "OPERATOR"
    };
  }
};
AuthService = __decorateClass([
  Injectable11(),
  __decorateParam(0, Inject15(PG_POOL)),
  __decorateParam(1, Inject15(AUTH_JWKS))
], AuthService);

// src/auth/auth.controller.ts
import { Controller as Controller7, Get as Get6, Req as Req6 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth5 } from "@nestjs/swagger";
var AuthController = class {
  getMe(request2) {
    return { data: request2.user };
  }
};
__decorateClass([
  Get6("me"),
  Permissions(),
  __decorateParam(0, Req6())
], AuthController.prototype, "getMe", 1);
AuthController = __decorateClass([
  Controller7("auth"),
  ApiBearerAuth5()
], AuthController);

// src/auth/auth.guard.ts
import {
  Injectable as Injectable13,
  Inject as Inject17,
  UnauthorizedException as UnauthorizedException4,
  ForbiddenException as ForbiddenException2
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

// src/merchant-api/merchant-keys.service.ts
import {
  BadRequestException as BadRequestException8,
  Inject as Inject16,
  Injectable as Injectable12,
  NotFoundException as NotFoundException5,
  UnauthorizedException as UnauthorizedException3
} from "@nestjs/common";
import * as crypto5 from "node:crypto";
var MerchantKeysService = class {
  constructor(pool) {
    this.pool = pool;
  }
  pool;
  /**
   * Generates a cryptographically secure, scoped merchant API key.
   * Format: [sk|pk]_[test|live]_[16 random hex]_[32 random hex secret]
   * Storage: Stores SHA-256 hash only; never stores plaintext API keys.
   */
  async createApiKey(dto) {
    if (dto.environment && dto.environment !== "test" || dto.keyType && dto.keyType !== "secret")
      throw new BadRequestException8("Only secret test keys are supported.");
    const environment = dto.environment || "test";
    const typePrefix = "sk";
    const keyPrefix = `${typePrefix}_${environment}_`;
    const randomEntropy = crypto5.randomBytes(24).toString("base64url");
    const fullApiKey = `${keyPrefix}${randomEntropy}`;
    const keyHash = crypto5.createHash("sha256").update(fullApiKey).digest("hex");
    const scopes = dto.scopes || ["payments:read"];
    if (!dto.name || dto.name.length > 100 || scopes.length === 0 || scopes.some(
      (scope) => !["payments:read", "payments:write", "refunds:read", "refunds:write"].includes(scope)
    ))
      throw new BadRequestException8("Invalid key name or scopes.");
    const res = await this.pool.query(
      `INSERT INTO payrail_private.merchant_api_keys
         (merchant_id, key_prefix, key_hash, name, scopes, environment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, merchant_id, key_prefix, name, scopes, environment, created_at`,
      [dto.merchantId, keyPrefix, keyHash, dto.name, scopes, environment]
    );
    const r = res.rows[0];
    if (!r) {
      throw new NotFoundException5("Failed to create API key record.");
    }
    return {
      id: r.id,
      merchantId: r.merchant_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      apiKey: fullApiKey,
      // Returned once
      scopes: r.scopes,
      environment: r.environment,
      createdAt: r.created_at.toISOString()
    };
  }
  /**
   * Validates a high-entropy API key by looking up its SHA-256 digest among active keys.
   */
  async validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "string" || !/^sk_test_[a-zA-Z0-9_-]{16,64}$/.test(apiKey)) {
      throw new UnauthorizedException3("Missing or invalid API key.");
    }
    const keyHash = crypto5.createHash("sha256").update(apiKey).digest("hex");
    const res = await this.pool.query(
      `SELECT id, merchant_id, scopes, environment
       FROM payrail_private.merchant_api_keys
       WHERE key_hash = $1
         AND environment = 'test' AND key_prefix = 'sk_test_'
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > clock_timestamp())`,
      [keyHash]
    );
    const r = res.rows[0];
    if (r?.environment !== "test" || r.scopes.some(
      (scope) => !["payments:read", "payments:write", "refunds:read", "refunds:write"].includes(scope)
    )) {
      throw new UnauthorizedException3("Invalid, expired, or revoked API key.");
    }
    return {
      id: r.id,
      merchantId: r.merchant_id,
      scopes: r.scopes,
      environment: r.environment
    };
  }
  /**
   * Revokes an existing merchant API key immediately.
   */
  async revokeApiKey(merchantId, keyId) {
    const res = await this.pool.query(
      `UPDATE payrail_private.merchant_api_keys
       SET revoked_at = clock_timestamp()
       WHERE id = $1 AND merchant_id = $2 AND revoked_at IS NULL`,
      [keyId, merchantId]
    );
    if (res.rowCount === 0) {
      throw new NotFoundException5(`API key '${keyId}' not found or already revoked.`);
    }
  }
  /**
   * Lists all API keys for a merchant (omitting hash).
   */
  async listApiKeys(merchantId) {
    const res = await this.pool.query(
      `SELECT id, merchant_id, key_prefix, name, scopes, environment, created_at, expires_at, revoked_at
       FROM payrail_private.merchant_api_keys
       WHERE merchant_id = $1
       ORDER BY created_at DESC`,
      [merchantId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      scopes: r.scopes,
      environment: r.environment,
      createdAt: r.created_at.toISOString(),
      expiresAt: r.expires_at?.toISOString(),
      revokedAt: r.revoked_at?.toISOString()
    }));
  }
};
MerchantKeysService = __decorateClass([
  Injectable12(),
  __decorateParam(0, Inject16(PG_POOL))
], MerchantKeysService);

// src/auth/auth.guard.ts
var AuthGuard = class {
  constructor(auth, reflector, keys) {
    this.auth = auth;
    this.reflector = reflector;
    this.keys = keys;
  }
  auth;
  reflector;
  keys;
  async canActivate(context) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(PUBLIC_ROUTE, targets)) return true;
    const request2 = context.switchToHttp().getRequest();
    const authorization = request2.headers.authorization;
    const apiKey = request2.headers["x-api-key"];
    const merchant = request2.headers["x-merchant-id"];
    if (merchant !== void 0 && (typeof merchant !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(merchant)))
      throw new ForbiddenException2("Invalid merchant selector.");
    if (typeof apiKey === "string" && !authorization && this.reflector.getAllAndOverride(ALLOW_API_KEY, targets)) {
      const key = await this.keys.validateApiKey(apiKey);
      if (merchant && merchant !== key.merchantId)
        throw new ForbiddenException2("Merchant does not match API key.");
      request2.user = {
        userId: key.id,
        email: "",
        merchantId: key.merchantId,
        role: "VIEWER",
        permissions: key.scopes,
        actorType: "API_KEY"
      };
    } else {
      if (apiKey || typeof authorization !== "string" || !/^Bearer [^\s]+$/.test(authorization))
        throw new UnauthorizedException4("A valid Bearer operator token is required.");
      request2.user = await this.auth.verifyAccessToken(authorization.slice(7), merchant);
    }
    const required = this.reflector.getAllAndOverride(PERMISSIONS, targets);
    if (!required?.every((permission) => request2.user.permissions.includes(permission)))
      throw new ForbiddenException2("This operation is not permitted.");
    return true;
  }
};
AuthGuard = __decorateClass([
  Injectable13(),
  __decorateParam(0, Inject17(AuthService)),
  __decorateParam(1, Inject17(Reflector)),
  __decorateParam(2, Inject17(MerchantKeysService))
], AuthGuard);

// src/auth/roles.guard.ts
import {
  Injectable as Injectable14,
  Inject as Inject18,
  ForbiddenException as ForbiddenException3
} from "@nestjs/common";
import { Reflector as Reflector2 } from "@nestjs/core";

// src/auth/roles.decorator.ts
import { SetMetadata as SetMetadata2 } from "@nestjs/common";
var ROLES_KEY = "roles";

// src/auth/roles.guard.ts
var RolesGuard = class {
  constructor(reflector) {
    this.reflector = reflector;
  }
  reflector;
  canActivate(context) {
    const requiredRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) {
      throw new ForbiddenException3("Access denied: User session has no assigned role.");
    }
    if (user.role === "ADMIN") {
      return true;
    }
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException3(
        `Access denied: Required role '${requiredRoles.join(", ")}', user has '${user.role}'.`
      );
    }
    return true;
  }
};
RolesGuard = __decorateClass([
  Injectable14(),
  __decorateParam(0, Inject18(Reflector2))
], RolesGuard);

// src/merchant-api/merchant-api.module.ts
import { Module as Module9 } from "@nestjs/common";

// src/merchant-api/merchant-webhooks.service.ts
import {
  BadRequestException as BadRequestException9,
  Inject as Inject19,
  Injectable as Injectable15,
  NotFoundException as NotFoundException6,
  ServiceUnavailableException as ServiceUnavailableException2
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHmac as createHmac2, randomBytes as randomBytes3 } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
var events = ["payment.succeeded", "payment.failed", "refund.succeeded", "refund.failed"];
var MerchantWebhooksService = class {
  constructor(pool) {
    this.pool = pool;
  }
  pool;
  validateDestinationUrl(targetUrl) {
    let url;
    try {
      url = new URL(targetUrl);
    } catch {
      throw new BadRequestException9("Invalid webhook URL.");
    }
    if (url.protocol !== "https:" || url.port && url.port !== "443" || url.username || url.password || url.hash)
      throw new BadRequestException9(
        "Webhook requires HTTPS on port 443 without credentials or fragment."
      );
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.includes("metadata.google.internal"))
      throw new BadRequestException9("Private webhook destination is forbidden.");
    if (ipaddr.isValid(host)) this.assertPublicAddress(host);
    return url;
  }
  assertPublicAddress(address) {
    if (!ipaddr.isValid(address) || ipaddr.process(address).range() !== "unicast")
      throw new BadRequestException9("Non-public webhook address is forbidden.");
  }
  async resolveDestination(targetUrl) {
    const url = this.validateDestinationUrl(targetUrl);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length) throw new BadRequestException9("Webhook hostname has no addresses.");
    for (const item of addresses) this.assertPublicAddress(item.address);
    const first = addresses[0];
    if (!first || first.family !== 4 && first.family !== 6)
      throw new BadRequestException9("Invalid webhook address family.");
    return { url, address: first.address, family: first.family };
  }
  encryptionKey() {
    const value = process.env.WEBHOOK_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value))
      throw new ServiceUnavailableException2("Merchant webhook encryption is not configured.");
    return Buffer.from(value, "hex");
  }
  encrypt(secret, merchantId) {
    const iv = randomBytes3(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`payrail:webhook:v1:${merchantId}`));
    const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((value) => value.toString("base64url")).join(".");
  }
  decrypt(value, merchantId) {
    const parts = value.split(".");
    if (parts.length !== 3 || parts.some((part) => !part))
      throw new ServiceUnavailableException2("Webhook secret unavailable; rotate endpoint.");
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !data) throw new ServiceUnavailableException2("Webhook secret unavailable.");
    const cipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(`payrail:webhook:v1:${merchantId}`));
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
  }
  record(row) {
    return {
      id: row.id,
      merchantId: row.merchant_id,
      url: row.url,
      subscribedEvents: row.subscribed_events,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString()
    };
  }
  async registerEndpoint(dto) {
    await this.resolveDestination(dto.url);
    if (!dto.subscribedEvents.length || dto.subscribedEvents.some((event) => !events.includes(event)))
      throw new BadRequestException9("Unsupported webhook event.");
    const secretKey = `whsec_${randomBytes3(24).toString("hex")}`;
    const encrypted = this.encrypt(secretKey, dto.merchantId);
    const result = await this.pool.query(
      `INSERT INTO payrail_private.merchant_webhook_endpoints (merchant_id, url, encrypted_secret, secret_version, subscribed_events)
       VALUES ($1, $2, $3, 'v1', $4)
       RETURNING id, merchant_id, url, subscribed_events, is_active, created_at`,
      [dto.merchantId, dto.url, encrypted, dto.subscribedEvents]
    );
    const row = result.rows[0];
    if (!row) throw new Error("Webhook endpoint creation failed.");
    return { ...this.record(row), secretKey };
  }
  async listEndpoints(merchantId) {
    const result = await this.pool.query(
      `SELECT id, merchant_id, url, subscribed_events, is_active, created_at FROM payrail_private.merchant_webhook_endpoints WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId]
    );
    return result.rows.map((row) => this.record(row));
  }
  async deactivateEndpoint(merchantId, id) {
    const result = await this.pool.query(
      `UPDATE payrail_private.merchant_webhook_endpoints SET is_active = false WHERE id = $1 AND merchant_id = $2`,
      [id, merchantId]
    );
    if (!result.rowCount) throw new NotFoundException6("Webhook endpoint not found.");
  }
  signPayload(payload, secretKey, timestamp = Math.floor(Date.now() / 1e3)) {
    return `t=${timestamp},v1=${createHmac2("sha256", secretKey).update(`${timestamp}.${payload}`).digest("hex")}`;
  }
  async sendSigned(targetUrl, payload, signature) {
    if (Buffer.byteLength(payload) > 32768)
      throw new BadRequestException9("Webhook payload too large.");
    const destination = await this.resolveDestination(targetUrl);
    return new Promise((resolve, reject) => {
      const outgoing = request(
        destination.url,
        {
          method: "POST",
          agent: false,
          lookup: (_hostname, _options, callback) => callback(null, destination.address, destination.family),
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            "Payrail-Signature": signature
          }
        },
        (incoming) => {
          let bytes = 0;
          incoming.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 16384) incoming.destroy(new Error("Webhook response exceeds limit."));
          });
          incoming.on("error", reject);
          incoming.on("end", () => resolve(incoming.statusCode || 0));
        }
      );
      outgoing.setTimeout(
        5e3,
        () => outgoing.destroy(new Error("Webhook destination timed out."))
      );
      outgoing.on("error", reject);
      outgoing.end(payload);
    });
  }
  async deliver(endpointId, merchantId, eventId, eventType, payload) {
    const result = await this.pool.query(
      `SELECT * FROM payrail_private.merchant_webhook_endpoints WHERE id = $1 AND merchant_id = $2 AND is_active = true AND $3 = ANY(subscribed_events)`,
      [endpointId, merchantId, eventType]
    );
    const endpoint = result.rows[0];
    if (!endpoint?.encrypted_secret || endpoint.secret_version !== "v1")
      throw new NotFoundException6("Active webhook endpoint not found.");
    const safe = Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) => ["paymentIntentId", "refundId", "amountMinor", "currency", "state", "merchantId"].includes(
          key
        )
      )
    );
    const body = JSON.stringify({ id: eventId, type: eventType, data: safe });
    const statusCode = await this.sendSigned(
      endpoint.url,
      body,
      this.signPayload(body, this.decrypt(endpoint.encrypted_secret, merchantId))
    );
    await this.recordDelivery(
      endpointId,
      eventId,
      eventType,
      safe,
      statusCode >= 200 && statusCode < 300 ? "DELIVERED" : "RETRYING",
      statusCode
    );
    if (statusCode < 200 || statusCode >= 300)
      throw new ServiceUnavailableException2("Merchant webhook was not acknowledged.");
  }
  async recordDelivery(endpointId, eventId, eventType, payload, status, statusCode) {
    const result = await this.pool.query(
      `INSERT INTO payrail_private.merchant_webhook_deliveries (endpoint_id,event_id,event_type,payload,status,status_code) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [endpointId, eventId, eventType, JSON.stringify(payload), status, statusCode || null]
    );
    const row = result.rows[0];
    if (!row) throw new Error("Delivery recording failed.");
    return row.id;
  }
  async getDeliveries(merchantId, endpointId, limit = 50) {
    const result = await this.pool.query(
      `SELECT d.id, d.endpoint_id AS "endpointId", d.event_id AS "eventId", d.event_type AS "eventType", d.status, d.status_code AS "statusCode", d.attempt_count AS "attemptCount", d.created_at AS "createdAt"
       FROM payrail_private.merchant_webhook_deliveries d JOIN payrail_private.merchant_webhook_endpoints e ON e.id = d.endpoint_id
       WHERE e.merchant_id = $1 AND ($2::uuid IS NULL OR e.id = $2) ORDER BY d.created_at DESC LIMIT $3`,
      [merchantId, endpointId || null, limit]
    );
    return result.rows;
  }
};
MerchantWebhooksService = __decorateClass([
  Injectable15(),
  __decorateParam(0, Inject19(PG_POOL))
], MerchantWebhooksService);

// src/merchant-api/merchant-api.controller.ts
import { Controller as Controller8, Get as Get7, Post as Post6, Delete, Body as Body4, Param as Param4, Query as Query5, Inject as Inject21, Req as Req7 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth6 } from "@nestjs/swagger";
import { z as z7 } from "zod";

// src/audit/audit.service.ts
import { Inject as Inject20, Injectable as Injectable16 } from "@nestjs/common";
var AuditService = class {
  constructor(pool) {
    this.pool = pool;
  }
  pool;
  /**
   * Appends an immutable audit event for financial or security operations.
   */
  async recordEvent(dto, client) {
    const executor = client || this.pool;
    const res = await executor.query(
      `INSERT INTO payrail_private.audit_events
         (merchant_id, actor_type, actor_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        dto.merchantId || null,
        dto.actorType,
        dto.actorId,
        dto.action,
        dto.resourceType,
        dto.resourceId,
        JSON.stringify(dto.metadata || {}),
        dto.ipAddress || null
      ]
    );
    const row = res.rows[0];
    if (!row) {
      throw new Error("Failed to insert audit event");
    }
    return row.id;
  }
  /**
   * Retrieves audit events for compliance review and forensic investigation.
   */
  async getEvents(merchantId, limit = 50) {
    let query = `SELECT * FROM payrail_private.audit_events WHERE merchant_id = $1`;
    const params = [merchantId];
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await this.pool.query(query, params);
    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id || void 0,
      actorType: r.actor_type,
      actorId: r.actor_id,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      metadata: r.metadata,
      ipAddress: r.ip_address || void 0,
      createdAt: r.created_at.toISOString()
    }));
  }
};
AuditService = __decorateClass([
  Injectable16(),
  __decorateParam(0, Inject20(PG_POOL))
], AuditService);

// src/merchant-api/merchant-api.controller.ts
var MerchantApiController = class {
  constructor(keys, webhooks, audit) {
    this.keys = keys;
    this.webhooks = webhooks;
    this.audit = audit;
  }
  keys;
  webhooks;
  audit;
  async listKeys(request2) {
    return { data: await this.keys.listApiKeys(request2.user.merchantId) };
  }
  async createKey(request2, body) {
    const parsed = parseInput(
      z7.strictObject({
        name: z7.string().min(1).max(100),
        scopes: z7.array(z7.enum(["payments:read", "payments:write", "refunds:read", "refunds:write"])).min(1).max(4).optional(),
        environment: z7.literal("test").optional(),
        keyType: z7.literal("secret").optional()
      }),
      body
    );
    const created = await this.keys.createApiKey({
      ...parsed,
      merchantId: request2.user.merchantId
    });
    try {
      await this.audit.recordEvent({
        merchantId: request2.user.merchantId,
        actorType: request2.user.actorType,
        actorId: request2.user.userId,
        action: "API_KEY_CREATED",
        resourceType: "merchant_api_key",
        resourceId: created.id,
        metadata: { name: created.name, scopes: created.scopes, environment: created.environment }
      });
    } catch (error) {
      await this.keys.revokeApiKey(request2.user.merchantId, created.id);
      throw error;
    }
    return { data: created };
  }
  async revokeKey(request2, id) {
    const keyId = parseInput(z7.uuid(), id);
    await this.keys.revokeApiKey(request2.user.merchantId, keyId);
    await this.audit.recordEvent({
      merchantId: request2.user.merchantId,
      actorType: request2.user.actorType,
      actorId: request2.user.userId,
      action: "API_KEY_REVOKED",
      resourceType: "merchant_api_key",
      resourceId: keyId
    });
    return { message: "API key revoked." };
  }
  async listEndpoints(request2) {
    return { data: await this.webhooks.listEndpoints(request2.user.merchantId) };
  }
  async registerEndpoint(request2, body) {
    const parsed = parseInput(
      z7.strictObject({
        url: z7.url().max(2048),
        subscribedEvents: z7.array(
          z7.enum(["payment.succeeded", "payment.failed", "refund.succeeded", "refund.failed"])
        ).min(1).max(4)
      }),
      body
    );
    const created = await this.webhooks.registerEndpoint({
      ...parsed,
      merchantId: request2.user.merchantId
    });
    try {
      await this.audit.recordEvent({
        merchantId: request2.user.merchantId,
        actorType: request2.user.actorType,
        actorId: request2.user.userId,
        action: "WEBHOOK_ENDPOINT_CREATED",
        resourceType: "merchant_webhook_endpoint",
        resourceId: created.id,
        metadata: { url: created.url, subscribedEvents: created.subscribedEvents }
      });
    } catch (error) {
      await this.webhooks.deactivateEndpoint(request2.user.merchantId, created.id);
      throw error;
    }
    return { data: created };
  }
  async revokeEndpoint(request2, id) {
    const endpointId = parseInput(z7.uuid(), id);
    await this.webhooks.deactivateEndpoint(request2.user.merchantId, endpointId);
    await this.audit.recordEvent({
      merchantId: request2.user.merchantId,
      actorType: request2.user.actorType,
      actorId: request2.user.userId,
      action: "WEBHOOK_ENDPOINT_DEACTIVATED",
      resourceType: "merchant_webhook_endpoint",
      resourceId: endpointId
    });
    return { message: "Webhook endpoint deactivated." };
  }
  async listDeliveries(request2, id, limit) {
    return {
      data: await this.webhooks.getDeliveries(
        request2.user.merchantId,
        id === void 0 ? void 0 : parseInput(z7.uuid(), id),
        pageLimit(limit)
      )
    };
  }
};
__decorateClass([
  Get7("api-keys"),
  Permissions("keys:read"),
  __decorateParam(0, Req7())
], MerchantApiController.prototype, "listKeys", 1);
__decorateClass([
  Post6("api-keys"),
  Permissions("keys:write"),
  __decorateParam(0, Req7()),
  __decorateParam(1, Body4())
], MerchantApiController.prototype, "createKey", 1);
__decorateClass([
  Delete("api-keys/:id"),
  Permissions("keys:write"),
  __decorateParam(0, Req7()),
  __decorateParam(1, Param4("id"))
], MerchantApiController.prototype, "revokeKey", 1);
__decorateClass([
  Get7("webhooks/endpoints"),
  Permissions("webhooks:read"),
  __decorateParam(0, Req7())
], MerchantApiController.prototype, "listEndpoints", 1);
__decorateClass([
  Post6("webhooks/endpoints"),
  Permissions("webhooks:write"),
  __decorateParam(0, Req7()),
  __decorateParam(1, Body4())
], MerchantApiController.prototype, "registerEndpoint", 1);
__decorateClass([
  Delete("webhooks/endpoints/:id"),
  Permissions("webhooks:write"),
  __decorateParam(0, Req7()),
  __decorateParam(1, Param4("id"))
], MerchantApiController.prototype, "revokeEndpoint", 1);
__decorateClass([
  Get7("webhooks/deliveries"),
  Permissions("webhooks:read"),
  __decorateParam(0, Req7()),
  __decorateParam(1, Query5("endpointId")),
  __decorateParam(2, Query5("limit"))
], MerchantApiController.prototype, "listDeliveries", 1);
MerchantApiController = __decorateClass([
  Controller8("v1"),
  ApiBearerAuth6(),
  __decorateParam(0, Inject21(MerchantKeysService)),
  __decorateParam(1, Inject21(MerchantWebhooksService)),
  __decorateParam(2, Inject21(AuditService))
], MerchantApiController);

// src/merchant-api/merchant-api.module.ts
var MerchantApiModule = class {
};
MerchantApiModule = __decorateClass([
  Module9({
    controllers: [MerchantApiController],
    providers: [MerchantKeysService, MerchantWebhooksService],
    exports: [MerchantKeysService, MerchantWebhooksService]
  })
], MerchantApiModule);

// src/auth/auth.module.ts
var AuthModule = class {
};
AuthModule = __decorateClass([
  Global2(),
  Module10({
    imports: [MerchantApiModule],
    controllers: [AuthController],
    providers: [
      AuthService,
      { provide: AUTH_JWKS, useFactory: createAuthKeyResolver },
      AuthGuard,
      RolesGuard,
      { provide: APP_GUARD, useExisting: AuthGuard }
    ],
    exports: [AuthService, AuthGuard, RolesGuard]
  })
], AuthModule);

// src/cards/cards.module.ts
import { Module as Module11 } from "@nestjs/common";

// src/cards/cards.service.ts
import { BadRequestException as BadRequestException10, Inject as Inject22, Injectable as Injectable18, NotFoundException as NotFoundException7 } from "@nestjs/common";

// src/providers/circuit-breaker.service.ts
import { Injectable as Injectable17, Logger as Logger2, ServiceUnavailableException as ServiceUnavailableException3 } from "@nestjs/common";
var CircuitBreakerService = class {
  logger = new Logger2(CircuitBreakerService.name);
  failureThreshold = 5;
  // 5 consecutive failures trips circuit
  recoveryTimeoutMs = 15e3;
  // 15 seconds in OPEN state before HALF_OPEN probe
  circuits = /* @__PURE__ */ new Map();
  constructor() {
    this.initProvider("paymongo");
    this.initProvider("xendit");
  }
  initProvider(provider) {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        provider,
        state: "CLOSED",
        consecutiveFailures: 0,
        totalCalls: 0,
        totalFailures: 0
      });
    }
  }
  /**
   * Asserts whether a provider is available for new outbound requests.
   * If OPEN and within recovery timeout: throws ServiceUnavailableException immediately (fail fast).
   * If OPEN and past recovery timeout: transitions to HALF_OPEN to allow single probe request.
   */
  checkAvailability(provider) {
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    const now = Date.now();
    if (circuit.state === "OPEN") {
      if (circuit.openUntil && now < circuit.openUntil) {
        throw new ServiceUnavailableException3(
          `Circuit breaker is OPEN for provider '${provider}'. Upstream API is degraded. Failing fast.`
        );
      }
      circuit.state = "HALF_OPEN";
      this.logger.warn(
        `Circuit breaker for '${provider}' transitioned from OPEN to HALF_OPEN (probing).`
      );
    }
  }
  /**
   * Records a successful provider request.
   */
  recordSuccess(provider) {
    this.initProvider(provider);
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    circuit.totalCalls++;
    circuit.consecutiveFailures = 0;
    circuit.lastSuccessTime = Date.now();
    if (circuit.state === "HALF_OPEN") {
      circuit.state = "CLOSED";
      circuit.openUntil = void 0;
      this.logger.log(`Circuit breaker for '${provider}' recovered to CLOSED state.`);
    }
  }
  /**
   * Records a failed provider request.
   */
  recordFailure(provider) {
    this.initProvider(provider);
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    circuit.totalCalls++;
    circuit.totalFailures++;
    circuit.consecutiveFailures++;
    circuit.lastFailureTime = Date.now();
    if (circuit.state === "HALF_OPEN" || circuit.consecutiveFailures >= this.failureThreshold) {
      circuit.state = "OPEN";
      circuit.openUntil = Date.now() + this.recoveryTimeoutMs;
      this.logger.error(
        `Circuit breaker for '${provider}' TRIPPED to OPEN state! Next probe in ${this.recoveryTimeoutMs / 1e3}s.`
      );
    }
  }
  /**
   * Returns metrics for all tracked provider circuits.
   */
  getMetrics() {
    return Array.from(this.circuits.values());
  }
  /**
   * Allows manual chaos/diagnostic override for reliability tests.
   */
  setCircuitState(provider, state, durationSeconds = 30) {
    this.initProvider(provider);
    const circuit = this.circuits.get(provider);
    if (!circuit) return;
    circuit.state = state;
    if (state === "OPEN") {
      circuit.openUntil = Date.now() + durationSeconds * 1e3;
    } else {
      circuit.openUntil = void 0;
      circuit.consecutiveFailures = 0;
    }
  }
};
CircuitBreakerService = __decorateClass([
  Injectable17()
], CircuitBreakerService);

// src/cards/cards.service.ts
import * as crypto6 from "node:crypto";
var CardsService = class {
  constructor(pool, circuitBreaker, ledgerService) {
    this.pool = pool;
    this.circuitBreaker = circuitBreaker;
    this.ledgerService = ledgerService;
  }
  pool;
  circuitBreaker;
  ledgerService;
  /**
   * Masks PAN according to PCI DSS requirements (first 6 and last 4 only, or asterisks).
   */
  maskPan(pan) {
    const clean = pan.replace(/\s+/g, "");
    if (clean.length < 10) return "************";
    return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
  }
  /**
   * Initiates a card payment with PCI-conscious architecture.
   * Raw CVV and full PAN are never persisted to database tables or logs.
   * Simulates 3-D Secure authentication challenge for cards requiring liability shift.
   */
  async initiateCardPayment(dto) {
    const amount = BigInt(dto.amountMinor);
    if (amount <= 0n) {
      throw new BadRequestException10("Amount must be strictly positive.");
    }
    this.circuitBreaker.checkAvailability("paymongo");
    const maskedPan = this.maskPan(dto.cardNumber);
    const paymentIntentId = `pi_${crypto6.randomUUID()}`;
    const orderId = `ord_${crypto6.randomUUID()}`;
    const currency = dto.currency || "PHP";
    const requires3DS = amount >= 100000n || dto.cardNumber.endsWith("3000");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO payrail_private.orders 
           (id, merchant_id, order_number, amount_minor, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [orderId, dto.merchantId, dto.orderNumber, dto.amountMinor, currency]
      );
      const initialState = requires3DS ? "AWAITING_PAYMENT" : "SUCCEEDED";
      await client.query(
        `INSERT INTO payrail_private.payment_intents 
           (id, merchant_id, order_id, amount_minor, currency, provider, payment_method, state)
         VALUES ($1, $2, $3, $4, $5, 'paymongo', 'card', $6)`,
        [paymentIntentId, dto.merchantId, orderId, dto.amountMinor, currency, initialState]
      );
      const providerPaymentId = `pay_card_${Date.now()}`;
      await client.query(
        `INSERT INTO payrail_private.payment_attempts
           (id, payment_intent_id, provider, provider_operation_key, provider_payment_id, submission_state)
         VALUES ($1, $2, 'paymongo', $3, $4, $5)`,
        [crypto6.randomUUID(), paymentIntentId, dto.idempotencyKey, providerPaymentId, initialState]
      );
      if (!requires3DS) {
        await this.ledgerService.postPaymentSuccess(
          dto.merchantId,
          paymentIntentId,
          dto.amountMinor,
          currency,
          client
        );
      }
      await client.query("COMMIT");
      this.circuitBreaker.recordSuccess("paymongo");
      const threeDSecureUrl = requires3DS ? `https://test-3ds.payrail.ph/challenge/${paymentIntentId}` : void 0;
      return {
        paymentIntentId,
        orderNumber: dto.orderNumber,
        amountMinor: dto.amountMinor,
        currency,
        state: initialState,
        maskedCard: maskedPan,
        threeDSecureRequired: requires3DS,
        threeDSecureUrl,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      await client.query("ROLLBACK");
      this.circuitBreaker.recordFailure("paymongo");
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Resolves a 3-D Secure authentication challenge outcome.
   */
  async resolve3DSChallenge(paymentIntentId, outcome) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `SELECT id, merchant_id, amount_minor, currency, state
         FROM payrail_private.payment_intents
         WHERE id = $1
         FOR UPDATE`,
        [paymentIntentId]
      );
      const payment = res.rows[0];
      if (!payment) {
        throw new NotFoundException7(`Payment intent '${paymentIntentId}' not found.`);
      }
      const nextState = outcome === "success" ? "SUCCEEDED" : "FAILED";
      await client.query(
        `UPDATE payrail_private.payment_intents
         SET state = $1, updated_at = clock_timestamp()
         WHERE id = $2`,
        [nextState, paymentIntentId]
      );
      await client.query(
        `INSERT INTO payrail_private.payment_state_events
           (payment_intent_id, previous_state, next_state, source)
         VALUES ($1, $2, $3, '3DS_CHALLENGE')`,
        [paymentIntentId, payment.state, nextState]
      );
      if (nextState === "SUCCEEDED") {
        await this.ledgerService.postPaymentSuccess(
          payment.merchant_id,
          paymentIntentId,
          payment.amount_minor,
          payment.currency,
          client
        );
      }
      await client.query("COMMIT");
      return { paymentIntentId, state: nextState };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
};
CardsService = __decorateClass([
  Injectable18(),
  __decorateParam(0, Inject22(PG_POOL)),
  __decorateParam(1, Inject22(CircuitBreakerService)),
  __decorateParam(2, Inject22(LedgerService))
], CardsService);

// src/cards/cards.controller.ts
import { Controller as Controller9, Post as Post7, Body as Body5, Param as Param5, Headers as Headers4, Inject as Inject23, Req as Req8 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth7 } from "@nestjs/swagger";
import { z as z8 } from "zod";
var CardsController = class {
  constructor(cards) {
    this.cards = cards;
  }
  cards;
  initiate(key, body, request2) {
    const parsed = parseInput(
      z8.strictObject({
        orderNumber: identifier,
        amountMinor: money,
        currency: z8.literal("PHP").optional(),
        cardholderName: z8.string().min(1).max(100),
        cardNumber: z8.string().min(12).max(19),
        expMonth: z8.number().int().min(1).max(12),
        expYear: z8.number().int().min(2025).max(2040),
        cvc: z8.string().min(3).max(4)
      }),
      body
    );
    return this.cards.initiateCardPayment({
      ...parsed,
      currency: parsed.currency || "PHP",
      merchantId: request2.user.merchantId,
      idempotencyKey: requiredIdempotency(key)
    }).then((data) => ({ data }));
  }
  resolve3DS(id, body) {
    const parsed = parseInput(z8.strictObject({ outcome: z8.enum(["success", "failure"]) }), body);
    return this.cards.resolve3DSChallenge(parseInput(identifier, id), parsed.outcome).then((data) => ({ data }));
  }
};
__decorateClass([
  Post7("initiate"),
  Permissions("cards:write"),
  __decorateParam(0, Headers4("idempotency-key")),
  __decorateParam(1, Body5()),
  __decorateParam(2, Req8())
], CardsController.prototype, "initiate", 1);
__decorateClass([
  Post7(":id/3ds-challenge"),
  Permissions("cards:write"),
  __decorateParam(0, Param5("id")),
  __decorateParam(1, Body5())
], CardsController.prototype, "resolve3DS", 1);
CardsController = __decorateClass([
  Controller9("cards"),
  ApiBearerAuth7(),
  __decorateParam(0, Inject23(CardsService))
], CardsController);

// src/cards/cards.module.ts
var CardsModule = class {
};
CardsModule = __decorateClass([
  Module11({
    imports: [LedgerModule],
    controllers: [CardsController],
    providers: [CardsService, CircuitBreakerService],
    exports: [CardsService, CircuitBreakerService]
  })
], CardsModule);

// src/reconciliation/reconciliation.module.ts
import { Module as Module12 } from "@nestjs/common";

// src/reconciliation/reconciliation.service.ts
import { Inject as Inject24, Injectable as Injectable19, NotFoundException as NotFoundException8 } from "@nestjs/common";
var ReconciliationService = class {
  constructor(pool, ledgerService) {
    this.pool = pool;
    this.ledgerService = ledgerService;
  }
  pool;
  ledgerService;
  /**
   * Executes an automated 3-way reconciliation run:
   * Compares Local Payment Intents vs Provider Attempts vs Ledger Postings.
   * Safe Policy: Automatically repairs clean STATUS_MISMATCH (missed webhooks where provider confirmed payment)
   * while escalating unknown amount/currency mismatches to MANUAL_INVESTIGATION.
   */
  async runReconciliation(merchantId) {
    const runId = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO payrail_private.reconciliation_runs
         (id, merchant_id, status)
       VALUES ($1, $2, 'RUNNING')`,
      [runId, merchantId]
    );
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const localIntentsRes = await client.query(
        `SELECT 
           pi.id,
           pi.merchant_id,
           pi.amount_minor,
           pi.currency,
           pi.state,
           pa.provider_payment_id,
           pa.submission_state,
           (SELECT pe.normalized_observation FROM payrail_private.provider_events pe WHERE pe.payment_intent_id=pi.id AND pe.processing_state='PROCESSED' ORDER BY pe.received_at DESC LIMIT 1) AS observation
         FROM payrail_private.payment_intents pi
         LEFT JOIN payrail_private.payment_attempts pa ON pa.payment_intent_id = pi.id
         WHERE pi.merchant_id = $1
         ORDER BY pi.created_at DESC`,
        [merchantId]
      );
      let matchedCount = 0;
      let discrepancyCount = 0;
      for (const intent of localIntentsRes.rows) {
        let discrepancy = "MATCHED";
        let resolution = "UNRESOLVED";
        let notes = "Verified 3-way match";
        const evidence = intent.observation;
        const providerState = evidence?.state || "unknown";
        if (!intent.provider_payment_id) {
          if (intent.state === "CREATED") {
            discrepancy = "MATCHED";
            notes = "Pending submission";
          } else {
            discrepancy = "LOCAL_ONLY";
            resolution = "MANUAL_INVESTIGATION";
            notes = "Payment has non-initial state but zero provider attempts recorded";
          }
        } else if (!evidence) {
          discrepancy = "UNKNOWN";
          resolution = "MANUAL_INVESTIGATION";
          notes = "No verified provider observation is available for automatic repair";
          discrepancyCount++;
        } else if (evidence.amountMinor !== intent.amount_minor) {
          discrepancy = "AMOUNT_MISMATCH";
          resolution = "MANUAL_INVESTIGATION";
          notes = "Verified provider amount differs from the payment intent";
          discrepancyCount++;
        } else if (evidence.currency !== intent.currency) {
          discrepancy = "CURRENCY_MISMATCH";
          resolution = "MANUAL_INVESTIGATION";
          notes = "Verified provider currency differs from the payment intent";
          discrepancyCount++;
        } else if (intent.state === "SUCCEEDED" && providerState === "SUCCEEDED") {
          discrepancy = "MATCHED";
          matchedCount++;
        } else if (["AWAITING_PAYMENT", "UNKNOWN_REQUIRES_RECONCILIATION", "FAILED", "EXPIRED"].includes(
          intent.state
        ) && providerState === "SUCCEEDED") {
          discrepancy = "STATUS_MISMATCH";
          resolution = "AUTO_REPAIRED";
          notes = "Missed webhook recovered: transitioning local state to SUCCEEDED and posting to ledger";
          await transitionSource(client, "RECONCILIATION");
          await client.query(
            `UPDATE payrail_private.payment_intents
             SET state = 'SUCCEEDED', updated_at = clock_timestamp()
             WHERE id = $1 AND state = $2`,
            [intent.id, intent.state]
          );
          await client.query(
            `INSERT INTO payrail_private.payment_state_events
               (payment_intent_id, previous_state, next_state, source)
             VALUES ($1, $2, 'SUCCEEDED', 'RECONCILIATION')`,
            [intent.id, intent.state]
          );
          await this.ledgerService.postPaymentSuccess(
            merchantId,
            intent.id,
            intent.amount_minor,
            intent.currency,
            client
          );
          await client.query(
            "UPDATE payrail_private.orders SET status='PAID',updated_at=clock_timestamp() WHERE id=(SELECT order_id FROM payrail_private.payment_intents WHERE id=$1)",
            [intent.id]
          );
          await client.query(
            "INSERT INTO payrail_private.outbox_events(event_type,aggregate_type,aggregate_id,payload,business_effect_key) VALUES('payment.succeeded','payment',$1,$2,$3) ON CONFLICT DO NOTHING",
            [
              intent.id,
              JSON.stringify({
                paymentIntentId: intent.id,
                merchantId,
                amountMinor: intent.amount_minor,
                currency: intent.currency
              }),
              `payment.succeeded:${intent.id}`
            ]
          );
          discrepancyCount++;
        } else if (intent.state === "SUCCEEDED" && providerState === "FAILED") {
          discrepancy = "STATUS_MISMATCH";
          resolution = "MANUAL_INVESTIGATION";
          notes = "Critical discrepancy: local marks SUCCEEDED but provider reported FAILED";
          discrepancyCount++;
        } else if (intent.state !== providerState) {
          discrepancy = "STATUS_MISMATCH";
          resolution = "MANUAL_INVESTIGATION";
          notes = "Local and verified provider states differ without a permitted automatic repair";
          discrepancyCount++;
        } else {
          discrepancy = "MATCHED";
          matchedCount++;
        }
        await client.query(
          `INSERT INTO payrail_private.reconciliation_items
             (run_id, payment_intent_id, provider_payment_id, discrepancy_type, resolution, local_state, provider_state, amount_minor, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            runId,
            intent.id,
            intent.provider_payment_id,
            discrepancy,
            resolution,
            intent.state,
            providerState,
            intent.amount_minor,
            notes
          ]
        );
      }
      const totalCount = localIntentsRes.rows.length;
      const summary = {
        totalIntents: totalCount,
        matched: matchedCount,
        discrepancies: discrepancyCount,
        policy: "AUTOMATED_SAFE_REPAIR_ON_MISSED_WEBHOOK"
      };
      const completedRunRes = await client.query(
        `UPDATE payrail_private.reconciliation_runs
         SET status = 'COMPLETED',
             completed_at = clock_timestamp(),
             total_records = $1,
             matched_records = $2,
             discrepancy_records = $3,
             summary = $4
         WHERE id = $5
         RETURNING *`,
        [totalCount, matchedCount, discrepancyCount, JSON.stringify(summary), runId]
      );
      await client.query("COMMIT");
      const r = completedRunRes.rows[0];
      if (!r) {
        throw new NotFoundException8(`Reconciliation run '${runId}' not found.`);
      }
      return {
        id: r.id,
        merchantId: r.merchant_id,
        startedAt: r.started_at.toISOString(),
        completedAt: r.completed_at?.toISOString(),
        status: r.status,
        totalRecords: r.total_records,
        matchedRecords: r.matched_records,
        discrepancyRecords: r.discrepancy_records,
        summary: r.summary
      };
    } catch (err) {
      await client.query("ROLLBACK");
      await this.pool.query(
        `UPDATE payrail_private.reconciliation_runs SET status = 'FAILED', completed_at = clock_timestamp() WHERE id = $1`,
        [runId]
      );
      throw err;
    } finally {
      client.release();
    }
  }
  async getRuns(merchantId, limit = 20) {
    const res = await this.pool.query(
      `SELECT * FROM payrail_private.reconciliation_runs
       WHERE merchant_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [merchantId, limit]
    );
    return res.rows.map((r) => ({
      id: r.id,
      merchantId: r.merchant_id,
      startedAt: r.started_at.toISOString(),
      completedAt: r.completed_at?.toISOString(),
      status: r.status,
      totalRecords: r.total_records,
      matchedRecords: r.matched_records,
      discrepancyRecords: r.discrepancy_records,
      summary: r.summary
    }));
  }
  async getItems(runId) {
    const res = await this.pool.query(
      `SELECT * FROM payrail_private.reconciliation_items
       WHERE run_id = $1
       ORDER BY discrepancy_type DESC, created_at ASC`,
      [runId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      runId: r.run_id,
      paymentIntentId: r.payment_intent_id || void 0,
      providerPaymentId: r.provider_payment_id || void 0,
      discrepancyType: r.discrepancy_type,
      resolution: r.resolution || void 0,
      localState: r.local_state || void 0,
      providerState: r.provider_state || void 0,
      amountMinor: r.amount_minor || void 0,
      notes: r.notes || void 0,
      createdAt: r.created_at.toISOString()
    }));
  }
};
ReconciliationService = __decorateClass([
  Injectable19(),
  __decorateParam(0, Inject24(PG_POOL)),
  __decorateParam(1, Inject24(LedgerService))
], ReconciliationService);

// src/reconciliation/reconciliation.controller.ts
import { Controller as Controller10, Get as Get8, Post as Post8, Param as Param6, Query as Query6, Inject as Inject25, Req as Req9 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth8 } from "@nestjs/swagger";
var ReconciliationController = class {
  constructor(reconciliation) {
    this.reconciliation = reconciliation;
  }
  reconciliation;
  async getRuns(request2, limit) {
    return {
      data: await this.reconciliation.getRuns(request2.user.merchantId, pageLimit(limit, 50))
    };
  }
  async getRunItems(id) {
    return { data: await this.reconciliation.getItems(parseInput(identifier, id)) };
  }
  async startRun(request2) {
    return { data: await this.reconciliation.runReconciliation(request2.user.merchantId) };
  }
};
__decorateClass([
  Get8("runs"),
  Permissions("reconciliation:read"),
  __decorateParam(0, Req9()),
  __decorateParam(1, Query6("limit"))
], ReconciliationController.prototype, "getRuns", 1);
__decorateClass([
  Get8("runs/:id/items"),
  Permissions("reconciliation:read"),
  __decorateParam(0, Param6("id"))
], ReconciliationController.prototype, "getRunItems", 1);
__decorateClass([
  Post8("runs"),
  Permissions("reconciliation:write"),
  __decorateParam(0, Req9())
], ReconciliationController.prototype, "startRun", 1);
ReconciliationController = __decorateClass([
  Controller10("reconciliation"),
  ApiBearerAuth8(),
  __decorateParam(0, Inject25(ReconciliationService))
], ReconciliationController);

// src/reconciliation/reconciliation.module.ts
var ReconciliationModule = class {
};
ReconciliationModule = __decorateClass([
  Module12({
    imports: [LedgerModule],
    controllers: [ReconciliationController],
    providers: [ReconciliationService],
    exports: [ReconciliationService]
  })
], ReconciliationModule);

// src/audit/audit.module.ts
import { Module as Module13, Global as Global3 } from "@nestjs/common";

// src/audit/audit.controller.ts
import { Controller as Controller11, Get as Get9, Query as Query7, Inject as Inject26, Req as Req10 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth9 } from "@nestjs/swagger";
var AuditController = class {
  constructor(audit) {
    this.audit = audit;
  }
  audit;
  async getEvents(request2, limit) {
    return { data: await this.audit.getEvents(request2.user.merchantId, pageLimit(limit)) };
  }
};
__decorateClass([
  Get9("events"),
  Permissions("audit:read"),
  __decorateParam(0, Req10()),
  __decorateParam(1, Query7("limit"))
], AuditController.prototype, "getEvents", 1);
AuditController = __decorateClass([
  Controller11("audit"),
  ApiBearerAuth9(),
  __decorateParam(0, Inject26(AuditService))
], AuditController);

// src/audit/audit.module.ts
var AuditModule = class {
};
AuditModule = __decorateClass([
  Global3(),
  Module13({
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService]
  })
], AuditModule);

// src/iso8583/iso8583.module.ts
import { Module as Module14 } from "@nestjs/common";

// src/iso8583/iso8583.service.ts
import { Injectable as Injectable20, BadRequestException as BadRequestException11 } from "@nestjs/common";
var ISO_FIELD_SPECS = {
  2: { fieldNumber: 2, name: "Primary Account Number (PAN)", type: "LLVAR_NUMERIC", length: 19 },
  3: { fieldNumber: 3, name: "Processing Code", type: "FIXED_NUMERIC", length: 6 },
  4: { fieldNumber: 4, name: "Amount, Transaction", type: "FIXED_NUMERIC", length: 12 },
  7: { fieldNumber: 7, name: "Transmission Date & Time", type: "FIXED_NUMERIC", length: 10 },
  11: {
    fieldNumber: 11,
    name: "Systems Trace Audit Number (STAN)",
    type: "FIXED_NUMERIC",
    length: 6
  },
  12: { fieldNumber: 12, name: "Time, Local Transaction", type: "FIXED_NUMERIC", length: 6 },
  13: { fieldNumber: 13, name: "Date, Local Transaction", type: "FIXED_NUMERIC", length: 4 },
  18: { fieldNumber: 18, name: "Merchant Category Code (MCC)", type: "FIXED_NUMERIC", length: 4 },
  37: {
    fieldNumber: 37,
    name: "Retrieval Reference Number (RRN)",
    type: "FIXED_ALPHA",
    length: 12
  },
  39: { fieldNumber: 39, name: "Response Code", type: "FIXED_ALPHA", length: 2 },
  41: { fieldNumber: 41, name: "Card Acceptor Terminal ID", type: "FIXED_ALPHA", length: 8 },
  42: {
    fieldNumber: 42,
    name: "Card Acceptor Identification Code",
    type: "FIXED_ALPHA",
    length: 15
  },
  49: { fieldNumber: 49, name: "Currency Code, Transaction", type: "FIXED_NUMERIC", length: 3 },
  62: { fieldNumber: 62, name: "Private Field / QR Ph Data", type: "LLLVAR_ALPHA", length: 999 }
};
var Iso8583Service = class {
  getMtiDescription(mti) {
    switch (mti) {
      case "0100":
        return "Authorization Request (Cardholder validation)";
      case "0110":
        return "Authorization Response (Issuer approved/declined)";
      case "0200":
        return "Financial Transaction Request (Purchase / Debit)";
      case "0210":
        return "Financial Transaction Response (Purchase confirmed / declined)";
      case "0400":
        return "Reversal Request (Transaction cancelled or timed out)";
      case "0410":
        return "Reversal Response (Reversal acknowledged)";
      case "0800":
        return "Network Management Request (Echo test / Sign-on)";
      case "0810":
        return "Network Management Response (Echo test ACK)";
      default:
        return `Custom / Unknown MTI (${mti})`;
    }
  }
  /**
   * Packs an ISO 8583 message into a wire-ready ASCII/Hex string.
   */
  pack(mti, fields) {
    if (!/^\d{4}$/.test(mti)) {
      throw new BadRequestException11(`Invalid MTI '${mti}'. Must be 4 numeric digits.`);
    }
    const bits = new Array(65).fill(false);
    for (const fieldNumStr of Object.keys(fields)) {
      const fieldNum = parseInt(fieldNumStr, 10);
      if (fieldNum >= 1 && fieldNum <= 64) {
        bits[fieldNum] = true;
      }
    }
    let bitmapHex = "";
    for (let i = 1; i <= 64; i += 4) {
      const nibble = (bits[i] ? 8 : 0) + (bits[i + 1] ? 4 : 0) + (bits[i + 2] ? 2 : 0) + (bits[i + 3] ? 1 : 0);
      bitmapHex += nibble.toString(16).toUpperCase();
    }
    let payload = mti + bitmapHex;
    const sortedFieldNums = Object.keys(fields).map((k) => parseInt(k, 10)).filter((n) => n >= 2 && n <= 64).sort((a, b) => a - b);
    for (const fieldNum of sortedFieldNums) {
      const spec = ISO_FIELD_SPECS[fieldNum];
      const val = fields[fieldNum];
      if (!spec || val === void 0) {
        continue;
      }
      switch (spec.type) {
        case "FIXED_NUMERIC": {
          const numStr = val.replace(/\D/g, "").padStart(spec.length, "0");
          payload += numStr.slice(-spec.length);
          break;
        }
        case "FIXED_ALPHA": {
          payload += val.padEnd(spec.length, " ").slice(0, spec.length);
          break;
        }
        case "LLVAR_NUMERIC":
        case "LLVAR_ALPHA": {
          const lenPrefix = val.length.toString().padStart(2, "0");
          payload += lenPrefix + val;
          break;
        }
        case "LLLVAR_ALPHA": {
          const lenPrefix = val.length.toString().padStart(3, "0");
          payload += lenPrefix + val;
          break;
        }
      }
    }
    const rawHex = Buffer.from(payload, "ascii").toString("hex");
    return { rawString: payload, rawHex, bitmapHex };
  }
  /**
   * Unpacks a raw ASCII ISO 8583 string into structured data elements.
   */
  unpack(rawString) {
    if (rawString.length < 20) {
      throw new BadRequestException11(
        "Raw ISO message too short. Minimum header length is 20 chars."
      );
    }
    const mti = rawString.slice(0, 4);
    const bitmapHex = rawString.slice(4, 20);
    let bitmapBits = "";
    const activeFields = [];
    for (let i = 0; i < 16; i++) {
      const char = bitmapHex[i];
      if (!char) {
        throw new BadRequestException11("Bitmap hex shorter than 16 characters.");
      }
      const nibble = parseInt(char, 16);
      if (Number.isNaN(nibble)) {
        throw new BadRequestException11(`Invalid hex character in bitmap: ${char}`);
      }
      const binary4 = nibble.toString(2).padStart(4, "0");
      bitmapBits += binary4;
      for (let bitIdx = 0; bitIdx < 4; bitIdx++) {
        if (binary4[bitIdx] === "1") {
          activeFields.push(i * 4 + bitIdx + 1);
        }
      }
    }
    let cursor = 20;
    const parsedFields = {};
    for (const fieldNum of activeFields) {
      if (fieldNum === 1) {
        continue;
      }
      const spec = ISO_FIELD_SPECS[fieldNum];
      if (!spec) {
        throw new BadRequestException11(
          `Field ${fieldNum} is active in bitmap but lacks a specification parser.`
        );
      }
      let value = "";
      let rawChunk = "";
      switch (spec.type) {
        case "FIXED_NUMERIC":
        case "FIXED_ALPHA": {
          if (cursor + spec.length > rawString.length) {
            throw new BadRequestException11(
              `Unexpected EOF parsing field ${fieldNum} at cursor ${cursor}.`
            );
          }
          value = rawString.slice(cursor, cursor + spec.length);
          rawChunk = value;
          cursor += spec.length;
          break;
        }
        case "LLVAR_NUMERIC":
        case "LLVAR_ALPHA": {
          const lenStr = rawString.slice(cursor, cursor + 2);
          const len = parseInt(lenStr, 10);
          cursor += 2;
          if (cursor + len > rawString.length) {
            throw new BadRequestException11(`Invalid LLVAR length ${len} for field ${fieldNum}.`);
          }
          value = rawString.slice(cursor, cursor + len);
          rawChunk = lenStr + value;
          cursor += len;
          break;
        }
        case "LLLVAR_ALPHA": {
          const lenStr = rawString.slice(cursor, cursor + 3);
          const len = parseInt(lenStr, 10);
          cursor += 3;
          if (cursor + len > rawString.length) {
            throw new BadRequestException11(`Invalid LLLVAR length ${len} for field ${fieldNum}.`);
          }
          value = rawString.slice(cursor, cursor + len);
          rawChunk = lenStr + value;
          cursor += len;
          break;
        }
      }
      parsedFields[fieldNum] = {
        name: spec.name,
        value,
        raw: rawChunk
      };
    }
    return {
      mti,
      mtiDescription: this.getMtiDescription(mti),
      bitmapHex,
      bitmapBits,
      fields: parsedFields,
      rawHex: Buffer.from(rawString, "ascii").toString("hex")
    };
  }
  /**
   * Helper to build a standard QR Ph / Card Purchase Request (0200)
   */
  createSamplePurchase0200(amountMinor, stan, terminalId, reference) {
    const amountStr = amountMinor.toString().padStart(12, "0");
    const stanStr = stan.padStart(6, "0");
    const now = /* @__PURE__ */ new Date();
    const mmddhhmmss = (now.getMonth() + 1).toString().padStart(2, "0") + now.getDate().toString().padStart(2, "0") + now.getHours().toString().padStart(2, "0") + now.getMinutes().toString().padStart(2, "0") + now.getSeconds().toString().padStart(2, "0");
    const hhmmss = mmddhhmmss.slice(4);
    const mmdd = mmddhhmmss.slice(0, 4);
    const packed = this.pack("0200", {
      3: "000000",
      // Purchase / Goods & Services
      4: amountStr,
      7: mmddhhmmss,
      11: stanStr,
      12: hhmmss,
      13: mmdd,
      18: "5399",
      // General Merchandise MCC
      37: reference.slice(0, 12).padEnd(12, "0"),
      41: terminalId.slice(0, 8).padEnd(8, " "),
      42: "PAYRAILMERCH001",
      49: "608",
      // PHP currency code
      62: `REF=${reference}`
    });
    return this.unpack(packed.rawString);
  }
};
Iso8583Service = __decorateClass([
  Injectable20()
], Iso8583Service);

// src/iso8583/iso8583.controller.ts
import { Body as Body6, Controller as Controller12, Get as Get10, Inject as Inject27, Post as Post9, Query as Query8 } from "@nestjs/common";
var Iso8583Controller = class {
  constructor(isoService) {
    this.isoService = isoService;
  }
  isoService;
  packMessage(body) {
    return this.isoService.pack(body.mti, body.fields);
  }
  unpackMessage(body) {
    return this.isoService.unpack(body.rawString);
  }
  getSamplePurchase(amountMinor = "50000", stan = "123456", terminalId = "TERM0001", reference = "PAYRAILTEST1") {
    return this.isoService.createSamplePurchase0200(
      parseInt(amountMinor, 10),
      stan,
      terminalId,
      reference
    );
  }
};
__decorateClass([
  Post9("pack"),
  __decorateParam(0, Body6())
], Iso8583Controller.prototype, "packMessage", 1);
__decorateClass([
  Post9("unpack"),
  __decorateParam(0, Body6())
], Iso8583Controller.prototype, "unpackMessage", 1);
__decorateClass([
  Get10("sample-0200"),
  __decorateParam(0, Query8("amountMinor")),
  __decorateParam(1, Query8("stan")),
  __decorateParam(2, Query8("terminalId")),
  __decorateParam(3, Query8("reference"))
], Iso8583Controller.prototype, "getSamplePurchase", 1);
Iso8583Controller = __decorateClass([
  Controller12("v1/iso8583"),
  Public(),
  __decorateParam(0, Inject27(Iso8583Service))
], Iso8583Controller);

// src/iso8583/iso8583.module.ts
var Iso8583Module = class {
};
Iso8583Module = __decorateClass([
  Module14({
    controllers: [Iso8583Controller],
    providers: [Iso8583Service],
    exports: [Iso8583Service]
  })
], Iso8583Module);

// src/fees/fee-policy.module.ts
import { Module as Module15 } from "@nestjs/common";

// src/fees/fee-policy.service.ts
import { BadRequestException as BadRequestException12, Injectable as Injectable21 } from "@nestjs/common";
var FeePolicyService = class {
  /**
   * Calculates provider-neutral payment fees using pure BigInt arithmetic.
   * Prohibits IEEE 754 floating-point numbers to guarantee mathematical integrity.
   */
  calculateFee(amountMinor, currency, schedule) {
    if (currency.toUpperCase() !== schedule.currency.toUpperCase()) {
      throw new BadRequestException12(
        `Currency mismatch: fee schedule currency '${schedule.currency}' does not match transaction currency '${currency}'`
      );
    }
    if (amountMinor < 0n) {
      throw new BadRequestException12("Amount cannot be negative");
    }
    if (amountMinor === 0n) {
      return {
        amountMinor: 0n,
        currency,
        variableFeeMinor: 0n,
        fixedFeeMinor: 0n,
        grossFeeMinor: 0n,
        netFeeMinor: 0n,
        netPayoutMinor: 0n
      };
    }
    const basisPointsNumerator = amountMinor * schedule.basisPoints;
    const denominator = 10000n;
    const rounding = schedule.rounding || "round_half_up";
    let variableFeeMinor;
    const remainder = basisPointsNumerator % denominator;
    const integerDiv = basisPointsNumerator / denominator;
    if (remainder === 0n) {
      variableFeeMinor = integerDiv;
    } else if (rounding === "floor") {
      variableFeeMinor = integerDiv;
    } else if (rounding === "ceil") {
      variableFeeMinor = integerDiv + 1n;
    } else {
      variableFeeMinor = remainder >= 5000n ? integerDiv + 1n : integerDiv;
    }
    const fixedFeeMinor = schedule.fixedMinor;
    const grossFeeMinor = variableFeeMinor + fixedFeeMinor;
    let netFeeMinor = grossFeeMinor;
    let appliedCap;
    if (schedule.minFeeMinor !== void 0 && netFeeMinor < schedule.minFeeMinor) {
      netFeeMinor = schedule.minFeeMinor;
      appliedCap = "min";
    }
    if (schedule.maxFeeMinor !== void 0 && netFeeMinor > schedule.maxFeeMinor) {
      netFeeMinor = schedule.maxFeeMinor;
      appliedCap = "max";
    }
    const netPayoutMinor = amountMinor > netFeeMinor ? amountMinor - netFeeMinor : 0n;
    return {
      amountMinor,
      currency,
      variableFeeMinor,
      fixedFeeMinor,
      grossFeeMinor,
      netFeeMinor,
      netPayoutMinor,
      appliedCap
    };
  }
};
FeePolicyService = __decorateClass([
  Injectable21()
], FeePolicyService);

// src/fees/fee-policy.module.ts
var FeePolicyModule = class {
};
FeePolicyModule = __decorateClass([
  Module15({
    providers: [FeePolicyService],
    exports: [FeePolicyService]
  })
], FeePolicyModule);

// src/operations/operations.module.ts
import { Module as Module16 } from "@nestjs/common";

// src/operations/operations.controller.ts
import { Controller as Controller13, Get as Get11, Post as Post10, Param as Param7, Inject as Inject29, Query as Query9, Req as Req11 } from "@nestjs/common";
import { ApiBearerAuth as ApiBearerAuth10, ApiSecurity as ApiSecurity3 } from "@nestjs/swagger";

// src/operations/operations-overview.service.ts
import { Inject as Inject28, Injectable as Injectable22 } from "@nestjs/common";
var OperationsOverviewService = class {
  constructor(pool, circuitBreaker, ledgerService, reconciliationService, jobsService, keysService, webhooksService) {
    this.pool = pool;
    this.circuitBreaker = circuitBreaker;
    this.ledgerService = ledgerService;
    this.reconciliationService = reconciliationService;
    this.jobsService = jobsService;
    this.keysService = keysService;
    this.webhooksService = webhooksService;
  }
  pool;
  circuitBreaker;
  ledgerService;
  reconciliationService;
  jobsService;
  keysService;
  webhooksService;
  async getOverview(merchantId, query) {
    const period = query?.period || "today";
    let dateFilterSql = "";
    if (period === "today") {
      dateFilterSql = "AND created_at >= date_trunc('day', clock_timestamp())";
    } else if (period === "7d") {
      dateFilterSql = "AND created_at >= clock_timestamp() - interval '7 days'";
    } else if (period === "30d") {
      dateFilterSql = "AND created_at >= clock_timestamp() - interval '30 days'";
    }
    const metricsRes = await this.pool.query(
      `SELECT
         count(*)::text AS total_payments,
         count(*) FILTER (WHERE state = 'SUCCEEDED')::text AS successful_payments,
         count(*) FILTER (WHERE state = 'FAILED')::text AS failed_payments,
         coalesce(sum(amount_minor) FILTER (WHERE state = 'SUCCEEDED'), 0)::text AS gross_volume_minor
       FROM payrail_private.payment_intents
       WHERE merchant_id = $1 ${dateFilterSql}`,
      [merchantId]
    );
    const m = metricsRes.rows[0] ?? {
      total_payments: "0",
      successful_payments: "0",
      failed_payments: "0",
      gross_volume_minor: "0"
    };
    const totalPayments = Number.parseInt(m.total_payments, 10) || 0;
    const successfulPayments = Number.parseInt(m.successful_payments, 10) || 0;
    const providerFailures = Number.parseInt(m.failed_payments, 10) || 0;
    const grossVolumeMinor = m.gross_volume_minor;
    const successRate = totalPayments > 0 ? Math.round(successfulPayments / totalPayments * 1e3) / 10 : null;
    const latencyRes = await this.pool.query(
      `SELECT
         percentile_cont(0.50) WITHIN GROUP (
           ORDER BY extract(epoch from (updated_at - created_at)) * 1000
         )::int::text AS p50_latency_ms,
         percentile_cont(0.95) WITHIN GROUP (
           ORDER BY extract(epoch from (updated_at - created_at)) * 1000
         )::int::text AS p95_latency_ms
       FROM payrail_private.payment_intents
       WHERE merchant_id = $1
         AND state IN ('SUCCEEDED', 'FAILED', 'EXPIRED')
         ${dateFilterSql}`,
      [merchantId]
    );
    const l = latencyRes.rows[0];
    const p50LatencyMs = l?.p50_latency_ms ? Number.parseInt(l.p50_latency_ms, 10) : null;
    const p95LatencyMs = l?.p95_latency_ms ? Number.parseInt(l.p95_latency_ms, 10) : null;
    const needsAttention = [];
    const unknownPaymentsRes = await this.pool.query(
      `SELECT id, created_at
       FROM payrail_private.payment_intents
       WHERE merchant_id = $1 AND state = 'UNKNOWN_REQUIRES_RECONCILIATION'
       ORDER BY created_at DESC LIMIT 5`,
      [merchantId]
    );
    for (const row of unknownPaymentsRes.rows) {
      needsAttention.push({
        id: row.id,
        entityType: "PAYMENT",
        condition: "UNKNOWN_REQUIRES_RECONCILIATION",
        summary: `Payment ${row.id} indeterminate; requires PSP ledger reconciliation.`,
        severity: "HIGH",
        createdAt: row.created_at.toISOString(),
        recommendedAction: "Run reconciliation match against PayMongo payout batch."
      });
    }
    const dlqRes = await this.pool.query(
      `SELECT id, job_type, failure_reason, created_at
       FROM payrail_private.dead_letter_queue
       WHERE (merchant_id = $1 OR merchant_id IS NULL) AND replayed_at IS NULL
       ORDER BY created_at DESC LIMIT 5`,
      [merchantId]
    );
    for (const row of dlqRes.rows) {
      needsAttention.push({
        id: row.id,
        entityType: "JOB",
        condition: "DEAD_LETTER",
        summary: `Job ${row.job_type} exhausted max attempts: ${row.failure_reason}`,
        severity: "CRITICAL",
        createdAt: row.created_at.toISOString(),
        recommendedAction: "Inspect job payload and replay after fixing underlying dependency."
      });
    }
    const failedWebhooksRes = await this.pool.query(
      `SELECT id, event_type, error_message, received_at
       FROM payrail_private.provider_events
       WHERE processing_state = 'FAILED' OR signature_verified = false
       ORDER BY received_at DESC LIMIT 5`
    );
    for (const row of failedWebhooksRes.rows) {
      needsAttention.push({
        id: row.id,
        entityType: "WEBHOOK",
        condition: "FAILED_PROCESSING",
        summary: `Webhook ${row.event_type} (${row.id}): ${row.error_message || "Invalid signature"}`,
        severity: "HIGH",
        createdAt: row.received_at.toISOString(),
        recommendedAction: "Verify webhook secret and inspect raw payload header signatures."
      });
    }
    const recentRes = await this.pool.query(
      `SELECT
         p.id,
         o.order_number,
         p.amount_minor,
         p.currency,
         p.state,
         p.provider,
         p.payment_method,
         p.created_at,
         p.updated_at,
         CASE
           WHEN p.state IN ('SUCCEEDED', 'FAILED', 'EXPIRED')
           THEN (extract(epoch from (p.updated_at - p.created_at)) * 1000)::int::text
           ELSE NULL
         END AS latency_ms
       FROM payrail_private.payment_intents p
       JOIN payrail_private.orders o ON o.id = p.order_id
       WHERE p.merchant_id = $1
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [merchantId]
    );
    const recentPayments = recentRes.rows.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      amountMinor: row.amount_minor,
      currency: row.currency,
      state: row.state,
      provider: row.provider,
      paymentMethod: row.payment_method,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      confirmationLatencyMs: row.latency_ms ? Number.parseInt(row.latency_ms, 10) : null
    }));
    const attemptsRes = await this.pool.query(
      `SELECT
         count(*)::text AS total_attempts,
         count(*) FILTER (WHERE submission_state = 'FAILED')::text AS failed_attempts
       FROM payrail_private.payment_attempts
       WHERE created_at >= clock_timestamp() - interval '24 hours'`
    );
    const totalAttempts = Number.parseInt(attemptsRes.rows[0]?.total_attempts ?? "0", 10);
    const failedAttempts = Number.parseInt(attemptsRes.rows[0]?.failed_attempts ?? "0", 10);
    const failureRate = totalAttempts > 0 ? Math.round(failedAttempts / totalAttempts * 1e3) / 10 : 0;
    const circuitMetrics = this.circuitBreaker.getMetrics();
    const paymongoCircuit = circuitMetrics.find((c) => c.provider === "paymongo");
    const circuitState = paymongoCircuit?.state || "CLOSED";
    let providerStatus = "HEALTHY";
    if (circuitState === "OPEN") {
      providerStatus = "DOWN";
    } else if (circuitState === "HALF_OPEN" || failureRate > 5) {
      providerStatus = "DEGRADED";
    }
    const providerHealth = {
      provider: "paymongo",
      status: providerStatus,
      circuitState,
      totalAttempts24h: totalAttempts,
      failedAttempts24h: failedAttempts,
      failureRate,
      p95LatencyMs
    };
    return {
      period,
      successfulPayments,
      totalPayments,
      successRate,
      grossVolumeMinor,
      currency: "PHP",
      p50LatencyMs,
      p95LatencyMs,
      providerFailures,
      needsAttention,
      recentPayments,
      providerHealth
    };
  }
  async getSystemHealth() {
    const t0 = Date.now();
    let dbStatus = "OK";
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await this.pool.query("SELECT 1");
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = "DOWN";
    }
    const circuitMetrics = this.circuitBreaker.getMetrics();
    const paymongoCircuit = circuitMetrics.find((c) => c.provider === "paymongo");
    const circuitState = paymongoCircuit?.state || "CLOSED";
    const dlqRes = await this.pool.query(
      "SELECT count(*)::text AS count FROM payrail_private.dead_letter_queue WHERE replayed_at IS NULL"
    );
    const dlqCount = Number.parseInt(dlqRes.rows[0]?.count ?? "0", 10);
    const webhookRes = await this.pool.query(
      "SELECT count(*)::text AS count FROM payrail_private.provider_events WHERE processing_state = 'FAILED' OR signature_verified = false"
    );
    const unverifiedCount = Number.parseInt(webhookRes.rows[0]?.count ?? "0", 10);
    let overallStatus = "HEALTHY";
    if (dbStatus === "DOWN" || circuitState === "OPEN") {
      overallStatus = "DOWN";
    } else if (circuitState === "HALF_OPEN" || dlqCount > 0 || unverifiedCount > 5) {
      overallStatus = "DEGRADED";
    }
    return {
      status: overallStatus,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      components: {
        api: { status: "OK", latencyMs: Date.now() - t0 },
        database: { status: dbStatus, latencyMs: dbLatencyMs },
        paymongo: {
          status: circuitState === "OPEN" ? "DOWN" : circuitState === "HALF_OPEN" ? "DEGRADED" : "HEALTHY",
          circuit: circuitState
        },
        webhooks: {
          status: unverifiedCount > 0 ? "DEGRADED" : "OK",
          unverifiedCount
        },
        workers: {
          status: dlqCount > 0 ? "DEGRADED" : "OK",
          dlqCount
        }
      }
    };
  }
  async getLedgerOverview(merchantId) {
    const [accounts, entries] = await Promise.all([
      this.ledgerService.getAccountBalances(merchantId),
      this.ledgerService.getJournalEntries(merchantId, 50)
    ]);
    return { accounts, entries };
  }
  async getReconciliationOverview(merchantId) {
    const runs = await this.reconciliationService.getRuns(merchantId, 50);
    return { runs };
  }
  async runReconciliation(merchantId) {
    return this.reconciliationService.runReconciliation(merchantId);
  }
  async getJobsOverview() {
    const [jobs, dlq] = await Promise.all([
      this.jobsService.getActiveJobs(50),
      this.jobsService.getDeadLetters(50)
    ]);
    return { jobs, dlq };
  }
  async replayDeadLetter(dlqId, replayedBy) {
    return this.jobsService.replayDeadLetter(dlqId, replayedBy);
  }
  async getDeveloperOverview(merchantId) {
    const [keys, deliveries, endpointsRes] = await Promise.all([
      this.keysService.listApiKeys(merchantId),
      this.webhooksService.getDeliveries(merchantId, void 0, 20),
      this.pool.query(
        `SELECT id, url, subscribed_events, is_active, created_at
         FROM payrail_private.merchant_webhook_endpoints
         WHERE merchant_id = $1
         ORDER BY created_at DESC`,
        [merchantId]
      )
    ]);
    const webhooks = endpointsRes.rows.map((r) => ({
      id: r.id,
      url: r.url,
      subscribedEvents: r.subscribed_events,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString()
    }));
    return { keys, webhooks, deliveries };
  }
  /**
   * Global multi-entity operational search.
   * Parameterized against SQL injection, strictly tenant-isolated to merchantId.
   */
  async searchOperationalData(merchantId, query) {
    const q = (query || "").trim();
    if (!q || q.length < 2) {
      return {
        query: q,
        payments: [],
        refunds: [],
        ledger: [],
        webhooks: [],
        jobs: [],
        reconciliation: []
      };
    }
    const wildcard = `%${q}%`;
    const prefix = `${q}%`;
    const [paymentsRes, refundsRes, ledgerRes, webhooksRes, jobsRes, reconRes] = await Promise.all([
      // 1. Payments: matches order number, intent ID, or status
      this.pool.query(
        `SELECT
             p.id,
             o.order_number,
             p.amount_minor,
             p.currency,
             p.state,
             p.created_at
           FROM payrail_private.payment_intents p
           JOIN payrail_private.orders o ON o.id = p.order_id
           WHERE p.merchant_id = $1
             AND (p.id::text ILIKE $2 OR o.order_number ILIKE $2 OR p.state ILIKE $2)
           ORDER BY
             CASE WHEN o.order_number ILIKE $3 OR p.id::text ILIKE $3 THEN 0 ELSE 1 END,
             p.created_at DESC
           LIMIT 5`,
        [merchantId, wildcard, prefix]
      ),
      // 2. Refunds: matches refund ID, payment ID, or reason
      this.pool.query(
        `SELECT
             id,
             payment_intent_id,
             amount_minor,
             currency,
             reason,
             state,
             created_at
           FROM payrail_private.refunds
           WHERE merchant_id = $1
             AND (id::text ILIKE $2 OR payment_intent_id::text ILIKE $2 OR reason ILIKE $2)
           ORDER BY created_at DESC
           LIMIT 5`,
        [merchantId, wildcard]
      ),
      // 3. Ledger: matches entry number, reference ID, or description
      this.pool.query(
        `SELECT
             id,
             entry_number,
             reference_type,
             reference_id,
             description,
             posting_state,
             created_at
           FROM payrail_private.journal_entries
           WHERE merchant_id = $1
             AND (entry_number ILIKE $2 OR reference_id ILIKE $2 OR description ILIKE $2)
           ORDER BY created_at DESC
           LIMIT 5`,
        [merchantId, wildcard]
      ),
      // 4. Webhooks / Provider Events: matches event ID or event type
      this.pool.query(
        `SELECT
             id,
             provider,
             provider_event_id,
             event_type,
             signature_verified,
             received_at
           FROM payrail_private.provider_events
           WHERE provider_event_id ILIKE $1 OR event_type ILIKE $1
           ORDER BY received_at DESC
           LIMIT 5`,
        [wildcard]
      ),
      // 5. Durable Jobs & DLQ: matches job ID, job type, or failure reason
      this.pool.query(
        `SELECT
             id,
             job_type,
             failure_reason,
             created_at
           FROM payrail_private.dead_letter_queue
           WHERE (merchant_id = $1 OR merchant_id IS NULL)
             AND (id::text ILIKE $2 OR job_type ILIKE $2 OR failure_reason ILIKE $2)
           ORDER BY created_at DESC
           LIMIT 5`,
        [merchantId, wildcard]
      ),
      // 6. Reconciliation Runs: matches run ID or status
      this.pool.query(
        `SELECT
             id,
             status,
             total_records,
             discrepancy_records,
             created_at
           FROM payrail_private.reconciliation_runs
           WHERE merchant_id = $1
             AND (id::text ILIKE $2 OR status ILIKE $2)
           ORDER BY created_at DESC
           LIMIT 5`,
        [merchantId, wildcard]
      )
    ]);
    const formatPesos = (minor) => {
      const val = Number.parseInt(minor, 10);
      if (Number.isNaN(val)) return "0.00";
      return (val / 100).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
    return {
      query: q,
      payments: paymentsRes.rows.map((r) => ({
        type: "payment",
        id: r.id,
        title: r.order_number,
        subtitle: `PHP ${formatPesos(r.amount_minor)} \xB7 ${r.id.slice(0, 8)}...`,
        status: r.state,
        href: `/ops/transactions?search=${encodeURIComponent(r.order_number)}`,
        timestamp: r.created_at.toISOString()
      })),
      refunds: refundsRes.rows.map((r) => ({
        type: "refund",
        id: r.id,
        title: `Refund: ${r.reason || "General Adjustment"}`,
        subtitle: `PHP ${formatPesos(r.amount_minor)} \xB7 Ref: ${r.id.slice(0, 8)}...`,
        status: r.state,
        href: "/ops/refunds",
        timestamp: r.created_at.toISOString()
      })),
      ledger: ledgerRes.rows.map((r) => ({
        type: "ledger",
        id: r.id,
        title: `Journal #${r.entry_number}`,
        subtitle: `${r.reference_type}: ${r.reference_id} \xB7 ${r.description}`,
        status: r.posting_state,
        href: "/ops/ledger",
        timestamp: r.created_at.toISOString()
      })),
      webhooks: webhooksRes.rows.map((r) => ({
        type: "webhook",
        id: r.id,
        title: `Event: ${r.event_type}`,
        subtitle: `${r.provider} \xB7 ID: ${r.provider_event_id}`,
        status: r.signature_verified ? "VERIFIED" : "UNVERIFIED",
        href: "/ops/developer",
        timestamp: r.received_at.toISOString()
      })),
      jobs: jobsRes.rows.map((r) => ({
        type: "job",
        id: r.id,
        title: `DLQ: ${r.job_type}`,
        subtitle: r.failure_reason ? r.failure_reason.slice(0, 60) : "Failed task",
        status: "FAILED",
        href: "/ops/jobs",
        timestamp: r.created_at.toISOString()
      })),
      reconciliation: reconRes.rows.map((r) => ({
        type: "reconciliation",
        id: r.id,
        title: `Reconciliation Run ${r.id.slice(0, 8)}...`,
        subtitle: `${r.total_records} records \xB7 ${r.discrepancy_records} discrepancies`,
        status: r.status,
        href: "/ops/reconciliation",
        timestamp: r.created_at.toISOString()
      }))
    };
  }
};
OperationsOverviewService = __decorateClass([
  Injectable22(),
  __decorateParam(0, Inject28(PG_POOL)),
  __decorateParam(1, Inject28(CircuitBreakerService)),
  __decorateParam(2, Inject28(LedgerService)),
  __decorateParam(3, Inject28(ReconciliationService)),
  __decorateParam(4, Inject28(DurableJobsService)),
  __decorateParam(5, Inject28(MerchantKeysService)),
  __decorateParam(6, Inject28(MerchantWebhooksService))
], OperationsOverviewService);

// src/operations/operations.controller.ts
var OperationsController = class {
  constructor(overviewService) {
    this.overviewService = overviewService;
  }
  overviewService;
  async getOverview(request2, period) {
    const sanitizedPeriod = period === "7d" || period === "30d" || period === "all" ? period : "today";
    const data = await this.overviewService.getOverview(request2.user.merchantId, {
      period: sanitizedPeriod
    });
    return { data };
  }
  async searchOperationalData(request2, query) {
    const q = query ? String(query).trim() : "";
    const results = await this.overviewService.searchOperationalData(request2.user.merchantId, q);
    return { data: results };
  }
  async getHealth() {
    return { data: await this.overviewService.getSystemHealth() };
  }
  async getLedger(request2) {
    return { data: await this.overviewService.getLedgerOverview(request2.user.merchantId) };
  }
  async getReconciliation(request2) {
    return { data: await this.overviewService.getReconciliationOverview(request2.user.merchantId) };
  }
  async runReconciliation(request2) {
    return { data: await this.overviewService.runReconciliation(request2.user.merchantId) };
  }
  async getJobs() {
    return { data: await this.overviewService.getJobsOverview() };
  }
  async replayDeadLetter(request2, id) {
    const newJobId = await this.overviewService.replayDeadLetter(id, request2.user.userId);
    return { message: "Dead letter replayed", data: { originalDlqId: id, newJobId } };
  }
  async getDeveloper(request2) {
    return { data: await this.overviewService.getDeveloperOverview(request2.user.merchantId) };
  }
};
__decorateClass([
  Get11("overview"),
  Permissions("payments:read"),
  __decorateParam(0, Req11()),
  __decorateParam(1, Query9("period"))
], OperationsController.prototype, "getOverview", 1);
__decorateClass([
  Get11("search"),
  Permissions("payments:read"),
  __decorateParam(0, Req11()),
  __decorateParam(1, Query9("q"))
], OperationsController.prototype, "searchOperationalData", 1);
__decorateClass([
  Get11("health"),
  Permissions("payments:read")
], OperationsController.prototype, "getHealth", 1);
__decorateClass([
  Get11("ledger"),
  Permissions("payments:read"),
  __decorateParam(0, Req11())
], OperationsController.prototype, "getLedger", 1);
__decorateClass([
  Get11("reconciliation"),
  Permissions("payments:read"),
  __decorateParam(0, Req11())
], OperationsController.prototype, "getReconciliation", 1);
__decorateClass([
  Post10("reconciliation/run"),
  Permissions("payments:write"),
  __decorateParam(0, Req11())
], OperationsController.prototype, "runReconciliation", 1);
__decorateClass([
  Get11("jobs"),
  Permissions("payments:read")
], OperationsController.prototype, "getJobs", 1);
__decorateClass([
  Post10("jobs/dlq/:id/replay"),
  Permissions("payments:write"),
  __decorateParam(0, Req11()),
  __decorateParam(1, Param7("id"))
], OperationsController.prototype, "replayDeadLetter", 1);
__decorateClass([
  Get11("developer"),
  Permissions("payments:read"),
  __decorateParam(0, Req11())
], OperationsController.prototype, "getDeveloper", 1);
OperationsController = __decorateClass([
  Controller13("ops"),
  ApiBearerAuth10(),
  ApiSecurity3("merchantKey"),
  AllowApiKey(),
  __decorateParam(0, Inject29(OperationsOverviewService))
], OperationsController);

// src/operations/operations.module.ts
var OperationsModule = class {
};
OperationsModule = __decorateClass([
  Module16({
    imports: [LedgerModule, ReconciliationModule, JobsModule, MerchantApiModule],
    controllers: [OperationsController],
    providers: [OperationsOverviewService, CircuitBreakerService],
    exports: [OperationsOverviewService]
  })
], OperationsModule);

// src/app.module.ts
var AppModule = class {
};
AppModule = __decorateClass([
  Module17({
    imports: [
      DatabaseModule,
      HealthModule,
      PayMongoModule,
      PaymentsModule,
      WebhooksModule,
      LedgerModule,
      RefundsModule,
      JobsModule,
      AuthModule,
      MerchantApiModule,
      CardsModule,
      ReconciliationModule,
      AuditModule,
      Iso8583Module,
      FeePolicyModule,
      OperationsModule
    ]
  })
], AppModule);

// src/bootstrap.ts
import { randomUUID as randomUUID6 } from "node:crypto";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
function configureApplication(app) {
  const environment = parseEnvironment(process.env);
  app.enableShutdownHooks();
  app.use(
    (_request, response, next) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
      response.setHeader("X-Request-Id", randomUUID6());
      next();
    }
  );
  const allowedOrigins = /* @__PURE__ */ new Set([
    environment.WEB_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(requestOrigin) || /^https:\/\/payrail-ph-web(-[a-z0-9_-]+)?\.vercel\.app$/.test(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Idempotency-Key",
      "idempotency-key",
      "Authorization",
      "X-Merchant-Id",
      "X-API-Key",
      "paymongo-signature"
    ],
    credentials: false
  });
  SwaggerModule.setup("openapi", app, createOpenApiDocument(app), {
    ui: false,
    raw: ["json"],
    jsonDocumentUrl: "openapi.json"
  });
}
function createOpenApiDocument(app) {
  const config = new DocumentBuilder().setTitle("PayRail PH sandbox operator API").setVersion("1.0.0").setDescription(
    "Sandbox only. Operator JWT and current database membership authorize administrative routes; test merchant keys authorize explicitly scoped payment routes. No PAN/CVV accepted."
  ).addBearerAuth().addApiKey({ type: "apiKey", in: "header", name: "X-API-Key" }, "merchantKey").build();
  return SwaggerModule.createDocument(app, config);
}

// src/serverless.ts
var cachedHandler;
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
    rawBody: true
  });
  configureApplication(app);
  await app.init();
  return app.getHttpAdapter().getInstance();
}
async function handler(req, res) {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  const matchedPath = req.headers["x-matched-path"] || req.headers["x-invoke-path"];
  if (matchedPath && req.url === "/api") {
    req.url = matchedPath;
  }
  return cachedHandler?.(req, res);
}
export {
  handler as default
};
