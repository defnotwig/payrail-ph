import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { PG_POOL } from "../database/database.constants";
import type { DatabasePool } from "../database/database.pool";
import type { PoolClient } from "pg";

export interface CreateJournalEntryDto {
  merchantId: string;
  referenceType: "PAYMENT" | "REFUND" | "FEE" | "SETTLEMENT" | "ADJUSTMENT";
  referenceId: string;
  description: string;
  lines: Array<{
    accountNumber: string;
    direction: "DEBIT" | "CREDIT";
    amountMinor: string; // BIGINT string
    currency?: string;
  }>;
}

export interface JournalEntryRecord {
  id: string;
  merchantId: string;
  entryNumber: string;
  referenceType: string;
  referenceId: string;
  description: string;
  postedAt: string;
  createdAt: string;
  lines: Array<{
    id: string;
    accountNumber: string;
    accountName: string;
    direction: "DEBIT" | "CREDIT";
    amountMinor: string;
    currency: string;
  }>;
}

export interface AccountBalanceRecord {
  accountId: string;
  accountNumber: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  currency: string;
  debitTotalMinor: string;
  creditTotalMinor: string;
  netBalanceMinor: string;
}

@Injectable()
export class LedgerService {
  constructor(@Inject(PG_POOL) private readonly db: DatabasePool) {}

  /**
   * Posts an immutable double-entry journal entry.
   * Enforces:
   * 1. Total debits === Total credits (strictly balanced in minor units).
   * 2. All referenced accounts must exist for the specified merchant.
   * 3. Atomic database transaction with row locks on accounts to prevent concurrency anomalies.
   */
  async createJournalEntry(
    dto: CreateJournalEntryDto,
    externalClient?: PoolClient,
  ): Promise<JournalEntryRecord> {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException("Journal entry must contain at least two ledger lines.");
    }

    // 1. Invariant: Sum(Debits) === Sum(Credits)
    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const line of dto.lines) {
      const amount = BigInt(line.amountMinor);
      if (amount <= 0n) {
        throw new BadRequestException(
          `Line amount must be strictly positive: got ${line.amountMinor}`,
        );
      }
      if (line.direction === "DEBIT") {
        totalDebits += amount;
      } else if (line.direction === "CREDIT") {
        totalCredits += amount;
      } else {
        throw new BadRequestException(`Invalid direction: ${line.direction}`);
      }
    }

    if (totalDebits !== totalCredits) {
      throw new BadRequestException(
        `Unbalanced ledger entry: Total Debits (${totalDebits}) != Total Credits (${totalCredits}) in currency minor units.`,
      );
    }

    const executeOperation = async (client: PoolClient): Promise<JournalEntryRecord> => {
      // 2. Fetch and validate accounts
      const accountNumbers = [...new Set(dto.lines.map((l) => l.accountNumber))];
      const accountsRes = await client.query<{
        id: string;
        account_number: string;
        name: string;
        type: string;
        currency: string;
      }>(
        `SELECT id, account_number, name, type, currency 
         FROM payrail_private.accounts 
         WHERE merchant_id = $1 AND account_number = ANY($2::text[])
         FOR SHARE`,
        [dto.merchantId, accountNumbers],
      );

      const accountMap = new Map(accountsRes.rows.map((a) => [a.account_number, a]));

      for (const num of accountNumbers) {
        if (!accountMap.has(num)) {
          throw new NotFoundException(
            `Account '${num}' does not exist for merchant '${dto.merchantId}'.`,
          );
        }
      }

      // 3. Create Journal Entry
      const entryNumber = `JE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const entryRes = await client.query<{
        id: string;
        merchant_id: string;
        entry_number: string;
        reference_type: string;
        reference_id: string;
        description: string;
        posted_at: Date;
        created_at: Date;
      }>(
        `INSERT INTO payrail_private.journal_entries 
           (merchant_id, entry_number, reference_type, reference_id, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, merchant_id, entry_number, reference_type, reference_id, description, posted_at, created_at`,
        [dto.merchantId, entryNumber, dto.referenceType, dto.referenceId, dto.description],
      );

      const entry = entryRes.rows[0];
      if (!entry) {
        throw new InternalServerErrorException("Failed to insert journal entry.");
      }

      // 4. Insert Ledger Lines
      const createdLines: JournalEntryRecord["lines"] = [];

      for (const line of dto.lines) {
        const acc = accountMap.get(line.accountNumber);
        if (!acc) {
          throw new BadRequestException(`Account ${line.accountNumber} not found.`);
        }
        const lineCurrency = line.currency || acc.currency;

        const lineRes = await client.query<{
          id: string;
          journal_entry_id: string;
          account_id: string;
          direction: "DEBIT" | "CREDIT";
          amount_minor: string;
          currency: string;
        }>(
          `INSERT INTO payrail_private.ledger_lines 
             (journal_entry_id, account_id, direction, amount_minor, currency)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, journal_entry_id, account_id, direction, amount_minor, currency`,
          [entry.id, acc.id, line.direction, line.amountMinor, lineCurrency],
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
          currency: lineCurrency,
        });
      }

      return {
        id: entry.id,
        merchantId: entry.merchant_id,
        entryNumber: entry.entry_number,
        referenceType: entry.reference_type,
        referenceId: entry.reference_id,
        description: entry.description,
        postedAt: entry.posted_at.toISOString(),
        createdAt: entry.created_at.toISOString(),
        lines: createdLines,
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
  async postPaymentSuccess(
    merchantId: string,
    paymentIntentId: string,
    amountMinor: string,
    currency = "PHP",
    client?: PoolClient,
  ): Promise<JournalEntryRecord> {
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
            currency,
          },
          {
            accountNumber: "2000-MERCHANT-PAYABLE",
            direction: "CREDIT",
            amountMinor,
            currency,
          },
        ],
      },
      client,
    );
  }

  /**
   * Posts standard compensating journal entries for refunds:
   * Debit: 2000-MERCHANT-PAYABLE (Merchant payable decreases)
   * Credit: 1100-PSP-RECEIVABLE (Gateway receivable decreases)
   */
  async postRefund(
    merchantId: string,
    refundId: string,
    amountMinor: string,
    currency = "PHP",
    client?: PoolClient,
  ): Promise<JournalEntryRecord> {
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
            currency,
          },
          {
            accountNumber: "1100-PSP-RECEIVABLE",
            direction: "CREDIT",
            amountMinor,
            currency,
          },
        ],
      },
      client,
    );
  }

  /**
   * Retrieves account balances for a merchant, calculating net balances by account type.
   */
  async getAccountBalances(merchantId: string): Promise<AccountBalanceRecord[]> {
    const res = await this.db.query<{
      account_id: string;
      account_number: string;
      name: string;
      type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
      currency: string;
      debit_total: string | null;
      credit_total: string | null;
    }>(
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
      [merchantId],
    );

    return res.rows.map((row) => {
      const debits = BigInt(row.debit_total || "0");
      const credits = BigInt(row.credit_total || "0");

      let net: bigint;
      if (row.type === "ASSET" || row.type === "EXPENSE") {
        net = debits - credits;
      } else {
        // LIABILITY, EQUITY, REVENUE have normal credit balances
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
        netBalanceMinor: net.toString(),
      };
    });
  }

  /**
   * Retrieves recent journal entries with complete ledger line breakdown.
   */
  async getJournalEntries(merchantId: string, limit = 50): Promise<JournalEntryRecord[]> {
    const res = await this.db.query<{
      id: string;
      merchant_id: string;
      entry_number: string;
      reference_type: string;
      reference_id: string;
      description: string;
      posted_at: Date;
      created_at: Date;
      lines: JournalEntryRecord["lines"];
    }>(
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
      [merchantId, limit],
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
      lines: row.lines,
    }));
  }
}
