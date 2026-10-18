import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { LedgerService } from "../ledger/ledger.service";
import type { DatabasePool } from "../database/database.pool";
import { PaymentsService } from "../payments/payments.service";
import { RefundsService } from "../refunds/refunds.service";
import { PayMongoAdapter } from "../paymongo/paymongo.adapter";
import { WebhooksService } from "../webhooks/webhooks.service";
import { createHmac } from "node:crypto";
import { DurableJobsService } from "../jobs/durable-jobs.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";

// Real PostgreSQL, never optional. Each invocation creates and drops its own database.
const databaseName = `payrail_financial_test_${randomUUID().replaceAll("-", "")}`;
const adminUrl =
  process.env.FINANCIAL_TEST_ADMIN_URL || "postgresql://payrail@127.0.0.1:55434/postgres";
const address = new URL(adminUrl);
if (!["127.0.0.1", "localhost"].includes(address.hostname))
  throw new Error("Integration DB must be local");
address.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: adminUrl });
const pool = new Pool({ connectionString: address.toString(), max: 15 });
const db = pool as unknown as DatabasePool;
const ledger = new LedgerService(db);
const adapter = new PayMongoAdapter("sk_test_placeholder", "fixture");
const payments = new PaymentsService(db, adapter, ledger);
const refunds = new RefundsService(db, ledger, adapter);
const jobs = new DurableJobsService(db);

beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${databaseName}`);
  process.env.DATABASE_URL = address.toString();
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.PAYMONGO_WEBHOOK_SECRET = "financial_fixture_webhook_secret";
  const directory = resolve(process.cwd(), "../../packages/database/migrations");
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    await pool.query(await readFile(resolve(directory, file), "utf8"));
  }
}, 30000);
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await admin.end();
});

async function createPayment() {
  return payments.createQrPhPayment(
    { merchantId: "merchant_default", amountMinor: "15000", orderNumber: randomUUID() },
    randomUUID(),
  );
}
async function paid(
  payment: Awaited<ReturnType<typeof createPayment>>,
  eventId = randomUUID(),
  amount = 15000,
) {
  const body = JSON.stringify({
    data: {
      id: eventId,
      attributes: {
        type: "payment.paid",
        livemode: false,
        data: {
          id: `pay_${payment.id}`,
          attributes: {
            payment_intent_id: payment.providerPaymentIntentId,
            status: "paid",
            amount,
            currency: "PHP",
          },
        },
      },
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "financial_fixture_webhook_secret")
    .update(`${t}.${body}`)
    .digest("hex");
  return new WebhooksService(db, payments, adapter).processPayMongoWebhook(
    body,
    `t=${t},te=${signature}`,
  );
}

describe("PostgreSQL payment operations", () => {
  it("replays an omitted-order request without creating another operation", async () => {
    const key = randomUUID();
    const request = { merchantId: "merchant_default", amountMinor: "15000" };
    const first = await payments.createQrPhPayment(request, key);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((await payments.createQrPhPayment(request, key)).id).toBe(first.id);
  });
  it("keeps an uncertain provider outcome unknown and never resubmits the same idempotent operation", async () => {
    const key = randomUUID();
    let calls = 0;
    const original = adapter.createQrPhPayment.bind(adapter);
    adapter.createQrPhPayment = async () => {
      calls++;
      throw new Error("connection lost after provider accepted request");
    };
    try {
      await expect(
        payments.createQrPhPayment({ merchantId: "merchant_default", amountMinor: "15000" }, key),
      ).rejects.toThrow(/connection lost/);
      const row = await pool.query(
        "SELECT id,state FROM payrail_private.payment_intents WHERE id=(SELECT result_reference FROM payrail_private.idempotency_records WHERE merchant_id='merchant_default' AND operation='CREATE_QRPH_PAYMENT' AND idempotency_key=$1)",
        [key],
      );
      expect(row.rows[0]?.state).toBe("UNKNOWN_REQUIRES_RECONCILIATION");
      const replay = await payments.createQrPhPayment(
        { merchantId: "merchant_default", amountMinor: "15000" },
        key,
      );
      expect(replay.state).toBe("UNKNOWN_REQUIRES_RECONCILIATION");
      expect(calls).toBe(1);
      const jobs = await pool.query(
        "SELECT count(*)::int AS count FROM payrail_private.durable_jobs WHERE deduplication_key=$1",
        [`resolve:${row.rows[0]?.id}`],
      );
      expect(jobs.rows[0]?.count).toBe(1);
    } finally {
      adapter.createQrPhPayment = original;
    }
  });
  it("arbitrates ten concurrent creates using the same key", async () => {
    const key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        payments.createQrPhPayment({ merchantId: "merchant_default", amountMinor: "15000" }, key),
      ),
    );
    const count = await pool.query(
      "SELECT count(*)::int AS count FROM payrail_private.payment_intents WHERE id IN (SELECT result_reference FROM payrail_private.idempotency_records WHERE idempotency_key=$1)",
      [key],
    );
    expect(count.rows[0].count).toBe(1);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThan(0);
    expect(new Set(fulfilled.map((result) => result.value.id)).size).toBe(1);
    const operations = await pool.query(
      "SELECT count(*)::int AS count FROM payrail_private.payment_intents WHERE order_id IN (SELECT id FROM payrail_private.orders WHERE order_number LIKE $1)",
      [`${key}%`],
    );
    expect(operations.rows[0].count).toBe(0);
  });
  it("deduplicates a ten-delivery webhook storm and posts one journal", async () => {
    const payment = await createPayment();
    const event = randomUUID();
    await Promise.all(Array.from({ length: 10 }, () => paid(payment, event)));
    expect((await payments.getPaymentIntent(payment.id, "merchant_default")).state).toBe(
      "SUCCEEDED",
    );
    const result = await pool.query(
      "SELECT count(*)::int AS count FROM payrail_private.journal_entries WHERE reference_id=$1",
      [payment.id],
    );
    expect(result.rows[0].count).toBe(1);
    const outbox = await pool.query(
      "SELECT count(*)::int AS count FROM payrail_private.outbox_events WHERE aggregate_id=$1",
      [payment.id],
    );
    expect(outbox.rows[0].count).toBe(1);
  });
  it("rejects a signed paid observation with wrong amount", async () => {
    const payment = await createPayment();
    await paid(payment, randomUUID(), 1);
    expect((await payments.getPaymentIntent(payment.id, "merchant_default")).state).toBe(
      "AWAITING_PAYMENT",
    );
  });
  it("never accepts webhook source to reverse a definitive failure", async () => {
    const payment = await createPayment();
    await payments.applyGuardedTransition(payment.id, "FAILED", "PROVIDER_ADAPTER");
    await paid(payment);
    expect((await payments.getPaymentIntent(payment.id, "merchant_default")).state).toBe("FAILED");
  });
  it("creates a real SQL refund reservation and prevents concurrent over-refund", async () => {
    const payment = await createPayment();
    await paid(payment);
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        refunds.createRefund({
          merchantId: "merchant_default",
          paymentIntentId: payment.id,
          amountMinor: "10000",
          reason: "requested",
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const result = await pool.query(
      "SELECT sum(amount_minor)::text AS total FROM payrail_private.refunds WHERE payment_intent_id=$1 AND state IN ('PENDING','SUCCEEDED','UNKNOWN')",
      [payment.id],
    );
    expect(result.rows[0].total).toBe("10000");
  });
  it("repairs only a fully matching persisted verified provider observation", async () => {
    const payment = await createPayment();
    await pool.query(
      `INSERT INTO payrail_private.provider_events(id,provider,provider_account,environment,provider_event_id,event_type,payload_hash,raw_payload,signature_verified,processing_state,payment_intent_id,normalized_observation)
      VALUES($1,'paymongo','fixture','test',$2,'payment.paid','fixture-hash','{}',true,'PROCESSED',$3,$4)`,
      [
        `evt_${randomUUID()}`,
        randomUUID(),
        payment.id,
        JSON.stringify({
          providerPaymentIntentId: payment.providerPaymentIntentId,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          state: "SUCCEEDED",
        }),
      ],
    );
    await pool.query(
      "UPDATE payrail_private.payment_attempts SET submission_state='SUCCEEDED' WHERE payment_intent_id=$1",
      [payment.id],
    );
    const run = await new ReconciliationService(db, ledger).runReconciliation("merchant_default");
    expect(run.status).toBe("COMPLETED");
    expect((await payments.getPaymentIntent(payment.id, "merchant_default")).state).toBe(
      "SUCCEEDED",
    );
    const result = await pool.query(
      "SELECT resolution FROM payrail_private.reconciliation_items WHERE run_id=$1 AND payment_intent_id=$2",
      [run.id, payment.id],
    );
    expect(result.rows[0]?.resolution).toBe("AUTO_REPAIRED");
  });
});

async function transaction(operation: (client: import("pg").PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await operation(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

describe("PostgreSQL financial invariants", () => {
  it("fences job completion and failure with an expiring claim token", async () => {
    const jobId = await jobs.createJob("TEST_FENCE", { merchantId: "merchant_default" });
    const first = await jobs.claimJobs("worker-a", 100, 30);
    const firstClaim = first.find((job) => job.id === jobId);
    expect(firstClaim?.claimToken).toBeTruthy();
    const firstToken = firstClaim?.claimToken ?? "";
    expect(await jobs.claimJobs("worker-b", 100, 30)).toHaveLength(0);
    await pool.query(
      "UPDATE payrail_private.durable_jobs SET locked_until=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
      [jobId],
    );
    const second = await jobs.claimJobs("worker-b", 100, 30);
    const secondClaim = second.find((job) => job.id === jobId);
    const secondToken = secondClaim?.claimToken ?? "";
    expect(secondClaim?.claimToken).not.toBe(firstClaim?.claimToken);
    await expect(jobs.completeJob(jobId, "worker-a", firstToken)).rejects.toThrow(/stale/i);
    await expect(jobs.failJob(jobId, "worker-a", firstToken, "stale failure")).rejects.toThrow(
      /stale/i,
    );
    await jobs.completeJob(jobId, "worker-b", secondToken);
  });

  it("rejects an unbalanced journal committed through direct SQL", async () => {
    await expect(
      transaction(async (client) => {
        const entry = await client.query(
          "INSERT INTO payrail_private.journal_entries (merchant_id,entry_number,reference_type,reference_id,description) VALUES ('merchant_default',$1,'ADJUSTMENT',$1,'invalid') RETURNING id",
          [randomUUID()],
        );
        await client.query(
          "INSERT INTO payrail_private.ledger_lines (journal_entry_id,account_id,direction,amount_minor) SELECT $1,id,'DEBIT',100 FROM payrail_private.accounts WHERE account_number='1100-PSP-RECEIVABLE'",
          [entry.rows[0].id],
        );
      }),
    ).rejects.toThrow();
  });

  it("posts a payment business effect exactly once under concurrent calls", async () => {
    const reference = randomUUID();
    await Promise.all(
      Array.from({ length: 10 }, () =>
        ledger.postPaymentSuccess("merchant_default", reference, "15000"),
      ),
    );
    const result = await pool.query(
      "SELECT count(*)::int AS count FROM payrail_private.journal_entries WHERE reference_id=$1",
      [reference],
    );
    expect(result.rows[0].count).toBe(1);
  });

  it("rejects updates and deletes of posted ledger rows", async () => {
    const entry = await ledger.postPaymentSuccess("merchant_default", randomUUID(), "100");
    await expect(
      pool.query(
        "UPDATE payrail_private.ledger_lines SET amount_minor=101 WHERE journal_entry_id=$1",
        [entry.id],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query("DELETE FROM payrail_private.journal_entries WHERE id=$1", [entry.id]),
    ).rejects.toThrow();
  });

  it("rejects balanced numbers in different currencies", async () => {
    await expect(
      ledger.createJournalEntry({
        merchantId: "merchant_default",
        referenceType: "ADJUSTMENT",
        referenceId: randomUUID(),
        description: "invalid currency",
        lines: [
          {
            accountNumber: "1100-PSP-RECEIVABLE",
            direction: "DEBIT",
            amountMinor: "100",
            currency: "PHP",
          },
          {
            accountNumber: "2000-MERCHANT-PAYABLE",
            direction: "CREDIT",
            amountMinor: "100",
            currency: "USD",
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it("rejects mutation of immutable audit events", async () => {
    const result = await pool.query(
      "INSERT INTO payrail_private.audit_events(actor_type,actor_id,action,resource_type,resource_id) VALUES ('OPERATOR','test','test','test','test') RETURNING id",
    );
    await expect(
      pool.query("DELETE FROM payrail_private.audit_events WHERE id=$1", [result.rows[0].id]),
    ).rejects.toThrow();
  });
});
