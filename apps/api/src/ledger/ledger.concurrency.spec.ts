import { describe, it, expect, vi } from "vitest";
import { LedgerService } from "./ledger.service";
import type { DatabasePool } from "../database/database.pool";
import type { PoolClient } from "pg";
import { BadRequestException } from "@nestjs/common";

describe("Ledger Concurrency & Invariants", () => {
  describe("Multi-Currency Debit/Credit Balance Invariant", () => {
    it("rejects multi-currency journal entry where debits and credits balance across currencies but NOT per individual currency", async () => {
      const mockPool = {
        connect: vi.fn(),
        query: vi.fn(),
      } as unknown as DatabasePool;

      const ledgerService = new LedgerService(mockPool);

      // Debit 10000 PHP and Credit 10000 USD: numeric values match (10000 === 10000), but currencies differ!
      await expect(
        ledgerService.createJournalEntry({
          merchantId: "merchant_test",
          referenceType: "ADJUSTMENT",
          referenceId: "ref_fx_mismatch_1",
          description: "Unbalanced cross-currency journal",
          lines: [
            {
              accountNumber: "1100-PSP-RECEIVABLE",
              direction: "DEBIT",
              amountMinor: "10000",
              currency: "PHP",
            },
            {
              accountNumber: "2000-MERCHANT-PAYABLE",
              direction: "CREDIT",
              amountMinor: "10000",
              currency: "USD",
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts multi-currency journal entry when lines balance within each individual currency", async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("SELECT pg_advisory_xact_lock")) {
            return { rows: [] };
          }
          if (sql.includes("SELECT id FROM payrail_private.journal_entries")) {
            return { rows: [] };
          }
          if (sql.includes("SELECT id, account_number")) {
            return {
              rows: [
                {
                  id: "acc_php_rec",
                  account_number: "1100-PSP-RECEIVABLE",
                  name: "PSP Receivable PHP",
                  type: "ASSET",
                  currency: "PHP",
                },
                {
                  id: "acc_php_pay",
                  account_number: "2000-MERCHANT-PAYABLE",
                  name: "Merchant Payable PHP",
                  type: "LIABILITY",
                  currency: "PHP",
                },
                {
                  id: "acc_usd_rec",
                  account_number: "1110-PSP-RECEIVABLE-USD",
                  name: "PSP Receivable USD",
                  type: "ASSET",
                  currency: "USD",
                },
                {
                  id: "acc_usd_pay",
                  account_number: "2010-MERCHANT-PAYABLE-USD",
                  name: "Merchant Payable USD",
                  type: "LIABILITY",
                  currency: "USD",
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO payrail_private.journal_entries")) {
            return {
              rows: [
                {
                  id: "je_multi_curr_1",
                  merchant_id: "merchant_test",
                  entry_number: "JE-MC-001",
                  reference_type: "ADJUSTMENT",
                  reference_id: "ref_fx_balanced_1",
                  description: "Balanced multi-currency journal",
                  posted_at: new Date(),
                  created_at: new Date(),
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO payrail_private.ledger_lines")) {
            return {
              rows: [
                {
                  id: "line_1",
                  journal_entry_id: "je_multi_curr_1",
                  account_id: "acc_php_rec",
                  direction: "DEBIT",
                  amount_minor: "5000",
                  currency: "PHP",
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn(),
      } as unknown as DatabasePool;

      const ledgerService = new LedgerService(mockPool);

      const entry = await ledgerService.createJournalEntry({
        merchantId: "merchant_test",
        referenceType: "ADJUSTMENT",
        referenceId: "ref_fx_balanced_1",
        description: "Balanced multi-currency journal",
        lines: [
          // PHP pair (5000 === 5000)
          {
            accountNumber: "1100-PSP-RECEIVABLE",
            direction: "DEBIT",
            amountMinor: "5000",
            currency: "PHP",
          },
          {
            accountNumber: "2000-MERCHANT-PAYABLE",
            direction: "CREDIT",
            amountMinor: "5000",
            currency: "PHP",
          },
          // USD pair (100 === 100)
          {
            accountNumber: "1110-PSP-RECEIVABLE-USD",
            direction: "DEBIT",
            amountMinor: "100",
            currency: "USD",
          },
          {
            accountNumber: "2010-MERCHANT-PAYABLE-USD",
            direction: "CREDIT",
            amountMinor: "100",
            currency: "USD",
          },
        ],
      });

      expect(entry.id).toBe("je_multi_curr_1");
      expect(entry.lines).toHaveLength(4);
    });
  });

  describe("Concurrent Postings with Same Business Effect Reference", () => {
    it("safely handles 10 concurrent journal creations for the same payment reference by returning existing record without duplicating lines", async () => {
      let createdCount = 0;
      let existingEntryId: string | null = null;
      let isAdvisoryLocked = false;
      const acquireAdvisoryLock = async () => {
        while (isAdvisoryLocked) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        isAdvisoryLocked = true;
      };

      const createClient = (): PoolClient => {
        let holdsAdvisoryLock = false;
        return {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("SELECT pg_advisory_xact_lock")) {
              await acquireAdvisoryLock();
              holdsAdvisoryLock = true;
              return { rows: [] };
            }
            if (
              sql.includes("SELECT id FROM payrail_private.journal_entries WHERE merchant_id=$1")
            ) {
              if (existingEntryId) {
                return { rows: [{ id: existingEntryId }] };
              }
              return { rows: [] };
            }
            if (sql.includes("SELECT \n         e.id,")) {
              // getJournalEntries
              return {
                rows: [
                  {
                    id: existingEntryId || "je_ref_123",
                    merchant_id: "merchant_test",
                    entry_number: "JE-12345",
                    reference_type: "PAYMENT",
                    reference_id: "pi_concurrent_je",
                    description: "Payment settlement recognition",
                    posted_at: new Date(),
                    created_at: new Date(),
                    lines: [
                      {
                        id: "line_1",
                        accountNumber: "1100-PSP-RECEIVABLE",
                        accountName: "PSP Receivable",
                        direction: "DEBIT",
                        amountMinor: "15000",
                        currency: "PHP",
                      },
                      {
                        id: "line_2",
                        accountNumber: "2000-MERCHANT-PAYABLE",
                        accountName: "Merchant Payable",
                        direction: "CREDIT",
                        amountMinor: "15000",
                        currency: "PHP",
                      },
                    ],
                  },
                ],
              };
            }
            if (sql.includes("SELECT id, account_number")) {
              return {
                rows: [
                  {
                    id: "acc_1",
                    account_number: "1100-PSP-RECEIVABLE",
                    name: "PSP Receivable",
                    type: "ASSET",
                    currency: "PHP",
                  },
                  {
                    id: "acc_2",
                    account_number: "2000-MERCHANT-PAYABLE",
                    name: "Merchant Payable",
                    type: "LIABILITY",
                    currency: "PHP",
                  },
                ],
              };
            }
            if (sql.includes("INSERT INTO payrail_private.journal_entries")) {
              createdCount += 1;
              existingEntryId = "je_ref_123";
              return {
                rows: [
                  {
                    id: existingEntryId,
                    merchant_id: "merchant_test",
                    entry_number: "JE-12345",
                    reference_type: "PAYMENT",
                    reference_id: "pi_concurrent_je",
                    description: "Payment settlement recognition",
                    posted_at: new Date(),
                    created_at: new Date(),
                  },
                ],
              };
            }
            if (sql.includes("INSERT INTO payrail_private.ledger_lines")) {
              return {
                rows: [
                  {
                    id: "line_1",
                    journal_entry_id: existingEntryId,
                    account_id: "acc_1",
                    direction: "DEBIT",
                    amount_minor: "15000",
                    currency: "PHP",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
          release: vi.fn().mockImplementation(() => {
            if (holdsAdvisoryLock) {
              isAdvisoryLocked = false;
              holdsAdvisoryLock = false;
            }
          }),
        } as unknown as PoolClient;
      };

      const mockPool = {
        connect: vi.fn().mockImplementation(async () => createClient()),
        query: vi.fn(),
      } as unknown as DatabasePool;

      const ledgerService = new LedgerService(mockPool);

      // Execute 10 concurrent requests to post the same payment settlement
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          ledgerService.postPaymentSuccess("merchant_test", "pi_concurrent_je", "15000", "PHP"),
        ),
      );

      // Only exactly 1 journal entry was inserted
      expect(createdCount).toBe(1);
      expect(results).toHaveLength(10);
      for (const res of results) {
        expect(res.id).toBe("je_ref_123");
        expect(res.lines).toHaveLength(2);
      }
    });
  });
});
