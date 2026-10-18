import { Controller, Get, Post, Body, Query, Headers } from "@nestjs/common";
import type { LedgerService, CreateJournalEntryDto } from "./ledger.service";

@Controller("ledger")
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get("accounts")
  async getAccounts(@Headers("x-merchant-id") merchantId = "merchant_default") {
    const balances = await this.ledgerService.getAccountBalances(merchantId);
    return { data: balances };
  }

  @Get("entries")
  async getEntries(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Query("limit") limit = "50",
  ) {
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
    const entries = await this.ledgerService.getJournalEntries(merchantId, parsedLimit);
    return { data: entries };
  }

  @Post("entries")
  async createEntry(
    @Headers("x-merchant-id") merchantId = "merchant_default",
    @Body() body: Omit<CreateJournalEntryDto, "merchantId">,
  ) {
    const entry = await this.ledgerService.createJournalEntry({
      ...body,
      merchantId,
    });
    return { data: entry };
  }
}
