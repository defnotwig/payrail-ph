import { NextResponse, type NextRequest } from "next/server";
import {
  resolveInternalApiUrl,
  resolveDemoMerchantApiKey,
} from "../../../../lib/server-api-config";

export const dynamic = "force-dynamic";

interface SearchResultItem {
  type: "page" | "payment" | "refund" | "ledger" | "webhook" | "job" | "reconciliation";
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  href: string;
  timestamp?: string;
}

interface SearchResultsGrouped {
  query: string;
  payments: SearchResultItem[];
  refunds: SearchResultItem[];
  ledger: SearchResultItem[];
  webhooks: SearchResultItem[];
  jobs: SearchResultItem[];
  reconciliation: SearchResultItem[];
}

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") ?? "";
    const qLower = query.toLowerCase().trim();

    const apiBase = resolveInternalApiUrl();
    const apiKey = resolveDemoMerchantApiKey();

    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Request-Id": requestId,
      "X-Correlation-Id": requestId,
    };

    if (apiKey) {
      headers["X-API-Key"] = apiKey;
      headers["x-merchant-key"] = apiKey;
    }

    // 1. Attempt backend dedicated search endpoint first
    try {
      const targetUrl = new URL(`${apiBase}/ops/search`);
      targetUrl.searchParams.set("q", query);

      const response = await fetch(targetUrl.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (response.ok) {
        const json = await response.json();
        return NextResponse.json(json);
      }
    } catch {
      // Backend /ops/search failed, fallback to operational data sources
    }

    // 2. Resilient Fallback: Query live authoritative operational endpoints
    const [overviewRes, ledgerRes] = await Promise.all([
      fetch(`${apiBase}/ops/overview?period=all`, {
        method: "GET",
        headers,
        cache: "no-store",
      }).catch(() => null),
      fetch(`${apiBase}/ops/ledger`, {
        method: "GET",
        headers,
        cache: "no-store",
      }).catch(() => null),
    ]);

    const overviewJson = overviewRes?.ok ? await overviewRes.json().catch(() => null) : null;
    const ledgerJson = ledgerRes?.ok ? await ledgerRes.json().catch(() => null) : null;

    const overviewData = overviewJson?.data || {};
    const ledgerData = ledgerJson?.data || {};

    const formatPesos = (minorStr: string | number) => {
      const num = typeof minorStr === "string" ? Number.parseInt(minorStr, 10) : Number(minorStr);
      if (Number.isNaN(num)) return "0.00";
      return (num / 100).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Filter payments
    const payments: SearchResultItem[] = (overviewData.recentPayments || [])
      .filter((p: { id?: string; orderNumber?: string; state?: string }) => {
        if (!qLower) return true;
        return (
          p.orderNumber?.toLowerCase().includes(qLower) ||
          p.id?.toLowerCase().includes(qLower) ||
          p.state?.toLowerCase().includes(qLower)
        );
      })
      .slice(0, 5)
      .map(
        (p: {
          id: string;
          orderNumber: string;
          amountMinor: string;
          state: string;
          createdAt: string;
        }) => ({
          type: "payment",
          id: p.id,
          title: p.orderNumber,
          subtitle: `PHP ${formatPesos(p.amountMinor)} · ${p.id.slice(0, 8)}...`,
          status: p.state,
          href: `/ops/transactions?search=${encodeURIComponent(p.orderNumber)}`,
          timestamp: p.createdAt,
        }),
      );

    // Filter ledger entries
    const ledger: SearchResultItem[] = (ledgerData.entries || [])
      .filter((e: { entryNumber?: string; referenceId?: string; description?: string }) => {
        if (!qLower) return true;
        return (
          e.entryNumber?.toLowerCase().includes(qLower) ||
          e.referenceId?.toLowerCase().includes(qLower) ||
          e.description?.toLowerCase().includes(qLower)
        );
      })
      .slice(0, 5)
      .map(
        (e: {
          id: string;
          entryNumber: string;
          referenceType: string;
          referenceId: string;
          description: string;
          postedAt: string;
        }) => ({
          type: "ledger",
          id: e.id,
          title: `Journal #${e.entryNumber}`,
          subtitle: `${e.referenceType}: ${e.referenceId} · ${e.description}`,
          status: "POSTED",
          href: "/ops/ledger",
          timestamp: e.postedAt,
        }),
      );

    // Filter needs attention items
    const jobs: SearchResultItem[] = (overviewData.needsAttention || [])
      .filter((item: { entityType?: string; condition?: string; summary?: string }) => {
        if (item.entityType !== "JOB") return false;
        if (!qLower) return true;
        return (
          item.condition?.toLowerCase().includes(qLower) ||
          item.summary?.toLowerCase().includes(qLower)
        );
      })
      .slice(0, 5)
      .map((item: { id: string; condition: string; summary: string; createdAt: string }) => ({
        type: "job",
        id: item.id,
        title: `DLQ: ${item.condition}`,
        subtitle: item.summary,
        status: "FAILED",
        href: "/ops/jobs",
        timestamp: item.createdAt,
      }));

    const result: SearchResultsGrouped = {
      query,
      payments,
      refunds: [],
      ledger,
      webhooks: [],
      jobs,
      reconciliation: [],
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "INTERNAL_GATEWAY_ERROR",
        message: error instanceof Error ? error.message : "Failed to proxy search request",
        data: {
          query: "",
          payments: [],
          refunds: [],
          ledger: [],
          webhooks: [],
          jobs: [],
          reconciliation: [],
        },
      },
      { status: 502 },
    );
  }
}
