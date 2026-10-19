import { NextResponse, type NextRequest } from "next/server";
import {
  resolveInternalApiUrl,
  resolveDemoMerchantApiKey,
} from "../../../../lib/server-api-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") ?? "";

    const apiBase = resolveInternalApiUrl();
    const apiKey = resolveDemoMerchantApiKey();

    const targetUrl = new URL(`${apiBase}/ops/search`);
    targetUrl.searchParams.set("q", query);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Request-Id": requestId,
      "X-Correlation-Id": requestId,
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
      headers["x-merchant-key"] = apiKey;
    }

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "API_SEARCH_FAILED",
          message: `Operations backend returned status ${response.status}`,
          data: {
            query,
            payments: [],
            refunds: [],
            ledger: [],
            webhooks: [],
            jobs: [],
            reconciliation: [],
          },
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
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
