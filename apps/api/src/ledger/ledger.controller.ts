import { Controller, Get, Post, Body, Query, Inject, Req } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { z } from "zod";
import { LedgerService } from "./ledger.service";
import { Permissions, type OperatorRequest } from "../auth/authorization";
import { identifier, money, pageLimit, parseInput } from "../auth/validation";
@Controller("ledger")
@ApiBearerAuth()
export class LedgerController {
  constructor(@Inject(LedgerService) private readonly ledger: LedgerService) {}
  @Get("accounts")
  @Permissions("ledger:read")
  async getAccounts(@Req() request: OperatorRequest) {
    return { data: await this.ledger.getAccountBalances(request.user.merchantId) };
  }
  @Get("entries")
  @Permissions("ledger:read")
  async getEntries(@Req() request: OperatorRequest, @Query("limit") limit?: string) {
    return { data: await this.ledger.getJournalEntries(request.user.merchantId, pageLimit(limit)) };
  }
  @Post("entries")
  @Permissions("ledger:write")
  async createEntry(@Req() request: OperatorRequest, @Body() body: unknown) {
    const parsed = parseInput(
      z.strictObject({
        referenceType: z.literal("ADJUSTMENT"),
        referenceId: identifier,
        description: z.string().min(1).max(240),
        lines: z
          .array(
            z.strictObject({
              accountNumber: identifier,
              direction: z.enum(["DEBIT", "CREDIT"]),
              amountMinor: money,
              currency: z.literal("PHP").optional(),
            }),
          )
          .min(2)
          .max(50),
      }),
      body,
    );
    const lines = parsed.lines.map((line) => ({
      accountNumber: line.accountNumber,
      direction: line.direction,
      amountMinor: line.amountMinor,
      currency: line.currency || "PHP",
    }));
    return {
      data: await this.ledger.createJournalEntry({
        ...parsed,
        lines,
        merchantId: request.user.merchantId,
      }),
    };
  }
}
