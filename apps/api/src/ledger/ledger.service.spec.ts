import { describe, it, expect, vi, beforeEach } from "vitest";
import { LedgerService } from "./ledger.service";
import type { DatabasePool } from "../database/database.pool";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("LedgerService", () => {
  let service: LedgerService;
  let mockDb: { connect: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    };
    service = new LedgerService(mockDb as unknown as DatabasePool);
  });

  describe("Invariants: Balanced Double-Entry Enforcement", () => {
    it("rejects an unbalanced journal entry where debits != credits", async () => {
      await expect(
        service.createJournalEntry({
          merchantId: "merchant_test",
          referenceType: "PAYMENT",
          referenceId: "pi_123",
          description: "Unbalanced payment",
          lines: [
            { accountNumber: "1100-PSP-RECEIVABLE", direction: "DEBIT", amountMinor: "10000" }, // 100 PHP
            { accountNumber: "2000-MERCHANT-PAYABLE", direction: "CREDIT", amountMinor: "9500" }, // 95 PHP
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects non-positive amounts", async () => {
      await expect(
        service.createJournalEntry({
          merchantId: "merchant_test",
          referenceType: "PAYMENT",
          referenceId: "pi_123",
          description: "Zero amount",
          lines: [
            { accountNumber: "1100-PSP-RECEIVABLE", direction: "DEBIT", amountMinor: "0" },
            { accountNumber: "2000-MERCHANT-PAYABLE", direction: "CREDIT", amountMinor: "0" },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects entries with fewer than two lines", async () => {
      await expect(
        service.createJournalEntry({
          merchantId: "merchant_test",
          referenceType: "PAYMENT",
          referenceId: "pi_123",
          description: "Single line entry",
          lines: [
            { accountNumber: "1100-PSP-RECEIVABLE", direction: "DEBIT", amountMinor: "10000" },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a balanced journal entry and records ledger lines", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, account_number")) {
          return Promise.resolve({
            rows: [
              {
                id: "acc-1",
                account_number: "1100-PSP-RECEIVABLE",
                name: "PSP Receivable",
                type: "ASSET",
                currency: "PHP",
              },
              {
                id: "acc-2",
                account_number: "2000-MERCHANT-PAYABLE",
                name: "Merchant Payable",
                type: "LIABILITY",
                currency: "PHP",
              },
            ],
          });
        }
        if (sql.includes("INSERT INTO payrail_private.journal_entries")) {
          return Promise.resolve({
            rows: [
              {
                id: "je-1",
                merchant_id: "merchant_test",
                entry_number: "JE-123",
                reference_type: "PAYMENT",
                reference_id: "pi_123",
                description: "Test payment entry",
                posted_at: new Date(),
                created_at: new Date(),
              },
            ],
          });
        }
        if (sql.includes("INSERT INTO payrail_private.ledger_lines")) {
          return Promise.resolve({
            rows: [
              {
                id: "line-1",
                journal_entry_id: "je-1",
                account_id: "acc-1",
                direction: "DEBIT",
                amount_minor: "10000",
                currency: "PHP",
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const entry = await service.createJournalEntry({
        merchantId: "merchant_test",
        referenceType: "PAYMENT",
        referenceId: "pi_123",
        description: "Test payment entry",
        lines: [
          { accountNumber: "1100-PSP-RECEIVABLE", direction: "DEBIT", amountMinor: "10000" },
          { accountNumber: "2000-MERCHANT-PAYABLE", direction: "CREDIT", amountMinor: "10000" },
        ],
      });

      expect(entry.id).toBe("je-1");
      expect(entry.lines).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("throws NotFoundException if an account does not exist", async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, account_number")) {
          return Promise.resolve({ rows: [] }); // No accounts found
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        service.createJournalEntry({
          merchantId: "merchant_test",
          referenceType: "PAYMENT",
          referenceId: "pi_123",
          description: "Missing accounts",
          lines: [
            { accountNumber: "9999-NON-EXISTENT", direction: "DEBIT", amountMinor: "10000" },
            { accountNumber: "2000-MERCHANT-PAYABLE", direction: "CREDIT", amountMinor: "10000" },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("Balance Invariant by Account Type", () => {
    it("correctly computes asset balance as debits - credits and liability as credits - debits", async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            account_id: "acc-1",
            account_number: "1100-PSP-RECEIVABLE",
            name: "PSP Receivable",
            type: "ASSET",
            currency: "PHP",
            debit_total: "15000",
            credit_total: "5000",
          },
          {
            account_id: "acc-2",
            account_number: "2000-MERCHANT-PAYABLE",
            name: "Merchant Payable",
            type: "LIABILITY",
            currency: "PHP",
            debit_total: "2000",
            credit_total: "12000",
          },
        ],
      });

      const balances = await service.getAccountBalances("merchant_test");

      expect(balances).toHaveLength(2);
      // Asset: 15000 - 5000 = +10000
      expect(balances[0]?.netBalanceMinor).toBe("10000");
      // Liability: 12000 - 2000 = +10000
      expect(balances[1]?.netBalanceMinor).toBe("10000");
    });
  });
});
